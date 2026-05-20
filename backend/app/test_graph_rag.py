import unittest
from unittest.mock import MagicMock, patch
from app.models import DocumentChunk, GraphEntity, GraphRelationship, ChunkEntityAssociation
from app.services.graph_extraction import fallback_extraction, extract_and_store_graph
from app.services.retrieval import format_context

class TestGraphRAG(unittest.TestCase):
    def test_fallback_extraction(self):
        text = "Google acquired DeepMind in London."
        res = fallback_extraction(text)
        
        # Verify it extracts capitalized words as entities
        entity_names = [e["name"] for e in res["entities"]]
        self.assertIn("Google", entity_names)
        self.assertIn("DeepMind", entity_names)
        self.assertIn("London", entity_names)
        
        # Verify relationships are created between them
        self.assertTrue(len(res["relationships"]) > 0)
        self.assertEqual(res["relationships"][0]["type"], "RELATED_TO")

    @patch("app.services.graph_extraction.run_extraction_llm")
    def test_extract_and_store_graph_calls_db(self, mock_llm):
        # Setup mock LLM return value
        mock_llm.return_value = {
            "entities": [
                {"name": "Google", "type": "Organization", "description": "Tech company"},
                {"name": "DeepMind", "type": "Organization", "description": "AI research lab"}
            ],
            "relationships": [
                {"source": "Google", "target": "DeepMind", "type": "ACQUIRED", "description": "Acquired in 2014"}
            ]
        }
        
        db_mock = MagicMock()
        # Mock database select queries returning None (meaning entities do not exist yet)
        db_mock.scalar.return_value = None
        
        # Intercept db_mock.add to assign dummy IDs to GraphEntity
        next_id = [1]
        def mock_add(obj):
            if isinstance(obj, GraphEntity):
                obj.id = next_id[0]
                next_id[0] += 1
        db_mock.add.side_effect = mock_add
        
        chunk = DocumentChunk(id=1, text="Google acquired DeepMind.")
        extract_and_store_graph(db_mock, [chunk], document_id=100)
        
        # Verify db.add is called for entities, associations, and relationships
        added_types = [type(call[0][0]) for call in db_mock.add.call_args_list]
        print("ADDED TYPES:", added_types)
        self.assertTrue(any(t == GraphEntity for t in added_types))
        self.assertTrue(any(t == ChunkEntityAssociation for t in added_types))
        self.assertTrue(any(t == GraphRelationship for t in added_types))
        
        # Verify it commits
        db_mock.commit.assert_called()

    def test_format_context_with_graph(self):
        db_mock = MagicMock()
        
        # Mock document chunk hits
        chunk = DocumentChunk(id=1, document_id=10, text="This is raw document text.")
        hits = [(chunk, 0.9)]
        
        # Mock entity and relationship fetching
        entity = GraphEntity(id=5, name="TestEntity", entity_type="Concept", description="A test concept")
        other_entity = GraphEntity(id=6, name="OtherEntity", entity_type="Concept")
        rel = GraphRelationship(
            id=12,
            source_id=5,
            target_id=6,
            relation_type="DEPENDS_ON",
            description="Describes connection",
            source=entity,
            target=other_entity
        )
        
        # Mock database queries return values
        db_mock.scalars.return_value.all.side_effect = [
            [10], # active document bindings
            [5],  # entity_ids
            [entity], # entities list
            [rel] # relationships list
        ]
        
        context = format_context(db_mock, hits, agent_id=1)
        
        # Verify the returned context contains both vector document text and graph connections
        self.assertIn("This is raw document text", context)
        self.assertIn("เอนทิตีที่เกี่ยวข้อง", context)
        self.assertIn("TestEntity", context)
        self.assertIn("DEPENDS_ON", context)
        self.assertIn("OtherEntity", context)

if __name__ == "__main__":
    unittest.main()
