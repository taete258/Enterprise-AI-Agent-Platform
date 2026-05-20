import json
import re
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import DocumentChunk, GraphEntity, GraphRelationship, ChunkEntityAssociation, LLMModel, LLMProvider
from ..providers import get_client, ChatMessage
from .embeddings import embed_one

def clean_json_response(text: str) -> str:
    """Removes markdown code block formatting if present in the LLM output."""
    text = text.strip()
    if text.startswith("```"):
        # Remove starting ```json or ```
        text = re.sub(r"^```(json)?\n", "", text)
        # Remove ending ```
        text = re.sub(r"\n```$", "", text)
    return text.strip()

def run_extraction_llm(db: Session, text: str) -> dict:
    """Queries the first active LLM to extract entities and relationships."""
    # Find active model and provider
    model = db.scalar(select(LLMModel).where(LLMModel.is_active == True))
    if not model:
        raise ValueError("No active LLM model found for graph extraction")
    
    provider = db.scalar(select(LLMProvider).where(LLMProvider.id == model.provider_id, LLMProvider.is_active == True))
    if not provider:
        raise ValueError("No active LLM provider found for graph extraction")
    
    client = get_client(provider)
    
    prompt = (
        "You are a specialized system extracting entities and relationships for a knowledge graph (GraphRAG).\n"
        "Extract all key entities (e.g. Person, Organization, Location, Technology, Concept, Event) and the relations between them.\n"
        "Output a JSON object with keys 'entities' and 'relationships' according to the following JSON schema:\n\n"
        "{\n"
        "  \"entities\": [\n"
        "    {\"name\": \"Entity Name (proper noun or clean term)\", \"type\": \"Person|Organization|Location|Technology|Concept|Event\", \"description\": \"Brief context\"}\n"
        "  ],\n"
        "  \"relationships\": [\n"
        "    {\"source\": \"Exact name of source entity\", \"target\": \"Exact name of target entity\", \"type\": \"RELATIONSHIP_TYPE (uppercase, snake_case)\", \"description\": \"Short context of their connection\"}\n"
        "  ]\n"
        "}\n\n"
        "Output ONLY raw JSON. Do not include markdown code block formatting (such as ```json) or explanation outside the JSON.\n\n"
        f"Text content:\n---\n{text}\n---"
    )

    completion = client.chat(
        model=model.model_id,
        messages=[
            ChatMessage(role="system", content="You are a JSON-only extraction bot. Return valid JSON without markdown wrapping."),
            ChatMessage(role="user", content=prompt)
        ],
        temperature=0.1,
        max_tokens=2048
    )
    
    cleaned = clean_json_response(completion.content)
    return json.loads(cleaned)

def fallback_extraction(text: str) -> dict:
    """Regex-based fallback extraction if no LLM is configured or fails."""
    # 1. Extract English capitalized words (Proper Nouns)
    en_words = re.findall(r"\b[A-Z][a-zA-Z0-9_]{2,}\b", text)
    
    # 2. Extract Thai word blocks (Unicode range: \u0e00-\u0e7f)
    # We match sequences of Thai characters of length 3 to 12.
    th_words = re.findall(r"[\u0e00-\u0e7f]{3,12}", text)
    
    # Combine and deduplicate
    entities = list(set(en_words + th_words))
    
    # If still empty, fall back to any word-like sequence of length >= 3
    if not entities:
        entities = list(set(re.findall(r"\w{3,15}", text)))
        
    # Filter out pure numbers and limit to top 15
    entities = [e for e in entities if e.strip() and not e.isdigit()][:15]
    
    entity_list = []
    for e in entities:
        entity_list.append({
            "name": e,
            "type": "Concept",
            "description": f"สกัดโดยอัตโนมัติจากเนื้อหา: '{e}'"
        })
        
    relationships = []
    # Create simple co-occurrence relations between consecutive entities
    for i in range(len(entity_list) - 1):
        relationships.append({
            "source": entity_list[i]["name"],
            "target": entity_list[i+1]["name"],
            "type": "RELATED_TO",
            "description": "ปรากฏร่วมกันในเนื้อหาเดียวกัน"
        })
        
    return {"entities": entity_list, "relationships": relationships}


def extract_and_store_graph(db: Session, chunks: list[DocumentChunk], document_id: int):
    """Processes document chunks to extract entities, relationships, and associations, then saves to DB."""
    for chunk in chunks:
        try:
            # 1. Run extraction
            try:
                data = run_extraction_llm(db, chunk.text)
            except Exception as e:
                # Fallback to regex-based extraction if LLM fails
                print(f"LLM graph extraction failed, falling back to regex: {e}")
                data = fallback_extraction(chunk.text)
            
            entities_data = data.get("entities", [])
            relations_data = data.get("relationships", [])
            
            # Keep a map of name -> entity_id for relationship linking
            name_to_id = {}
            
            # 2. Store Entities
            for ent in entities_data:
                name = ent.get("name", "").strip()
                if not name:
                    continue
                
                # Check if entity already exists (case-insensitive)
                existing = db.scalar(
                    select(GraphEntity).where(GraphEntity.name.ilike(name))
                )
                
                if existing:
                    entity_obj = existing
                    # Update description if it was empty
                    if not entity_obj.description and ent.get("description"):
                        entity_obj.description = ent.get("description")
                else:
                    # Generate embedding
                    embedding = None
                    try:
                        embedding = embed_one(db, name)
                    except Exception:
                        pass
                    
                    entity_obj = GraphEntity(
                        name=name,
                        entity_type=ent.get("type", "Concept"),
                        description=ent.get("description", ""),
                        embedding=embedding
                    )
                    db.add(entity_obj)
                    db.flush() # populated entity_obj.id
                
                name_to_id[name.lower()] = entity_obj.id
                
                # Link Entity to this Chunk
                assoc_exists = db.scalar(
                    select(ChunkEntityAssociation).where(
                        ChunkEntityAssociation.chunk_id == chunk.id,
                        ChunkEntityAssociation.entity_id == entity_obj.id
                    )
                )
                if not assoc_exists:
                    db.add(ChunkEntityAssociation(chunk_id=chunk.id, entity_id=entity_obj.id))
            
            # 3. Store Relationships
            for rel in relations_data:
                src_name = rel.get("source", "").strip()
                tgt_name = rel.get("target", "").strip()
                rel_type = rel.get("type", "RELATED_TO").strip().upper()
                
                src_id = name_to_id.get(src_name.lower())
                tgt_id = name_to_id.get(tgt_name.lower())
                
                # If we don't have source/target in name_to_id, look up in database
                if not src_id and src_name:
                    src_ent = db.scalar(select(GraphEntity).where(GraphEntity.name.ilike(src_name)))
                    if src_ent:
                        src_id = src_ent.id
                if not tgt_id and tgt_name:
                    tgt_ent = db.scalar(select(GraphEntity).where(GraphEntity.name.ilike(tgt_name)))
                    if tgt_ent:
                        tgt_id = tgt_ent.id
                
                if src_id and tgt_id and src_id != tgt_id:
                    # Check if relationship already exists
                    existing_rel = db.scalar(
                        select(GraphRelationship).where(
                            GraphRelationship.source_id == src_id,
                            GraphRelationship.target_id == tgt_id,
                            GraphRelationship.relation_type == rel_type
                        )
                    )
                    
                    if not existing_rel:
                        db.add(GraphRelationship(
                            source_id=src_id,
                            target_id=tgt_id,
                            relation_type=rel_type,
                            description=rel.get("description", ""),
                            weight=1.0,
                            document_id=document_id
                        ))
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            print(f"Error processing graph extraction for chunk {chunk.id}: {e}")
