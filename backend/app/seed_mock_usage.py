import sys
import random
from datetime import datetime, timedelta
from app.db.session import SessionLocal
from app.models import User, Agent, LLMProvider, LLMModel, UsageRecord

def seed_data():
    db = SessionLocal()
    try:
        # 1. Get admin user or fallback
        user = db.query(User).filter(User.is_superuser == True).first()
        if not user:
            user = db.query(User).first()
            
        if not user:
            # Create a default admin user
            print("Creating default superuser...")
            user = User(
                email="admin@example.com",
                full_name="System Administrator",
                password_hash="pbkdf2:sha256:600000$mockhash$mock",
                is_active=True,
                is_superuser=True
            )
            db.add(user)
            db.flush()

        print(f"Using superuser: {user.email} (ID: {user.id})")

        # 2. Get or create provider
        provider = db.query(LLMProvider).first()
        if not provider:
            print("Creating mock LLMProvider...")
            provider = LLMProvider(name="OpenAI", kind="openai", api_key_encrypted="mock_key", is_active=True)
            db.add(provider)
            db.flush()
        
        # 3. Get or create model
        model = db.query(LLMModel).first()
        if not model:
            print("Creating mock LLMModel...")
            model = LLMModel(
                provider_id=provider.id,
                model_id="gpt-4o",
                display_name="GPT-4o",
                input_cost_per_1k=0.015,
                output_cost_per_1k=0.075,
                is_active=True
            )
            db.add(model)
            db.flush()

        # 4. Get or create base agent
        agent = db.query(Agent).first()
        if not agent:
            print("Creating mock Agent...")
            agent = Agent(
                name="General Support Agent",
                description="Supports all user tasks",
                system_prompt="You are a helpful support agent.",
                model_id=model.id,
                temperature=0.7,
                max_tokens=2048,
                owner_id=user.id,
                is_published=True
            )
            db.add(agent)
            db.flush()

        # 5. Create additional mock users for rich breakdowns
        dummy_users = [user]
        emails = [
            ("somsak.j@company.com", "Somsak Jaidee"),
            ("somchai.s@company.com", "Somchai Saetang"),
            ("noppadon.k@company.com", "Noppadon K."),
            ("sarah.w@company.com", "Sarah White")
        ]
        
        for email, name in emails:
            exist = db.query(User).filter(User.email == email).first()
            if not exist:
                u = User(
                    email=email,
                    full_name=name,
                    password_hash="mock_hash",
                    is_active=True,
                    is_superuser=False
                )
                db.add(u)
                db.flush()
                dummy_users.append(u)
            else:
                dummy_users.append(exist)

        # 6. Create additional mock agents for rich breakdowns
        dummy_agents = [agent]
        agent_names = [
            ("Customer Support Bot", "Helps customers solve issues"),
            ("HR Assistant", "Answers HR policy questions"),
            ("Data Analyzer", "Analyzes CSV and database data")
        ]
        for name, desc in agent_names:
            exist = db.query(Agent).filter(Agent.name == name).first()
            if not exist:
                a = Agent(
                    name=name,
                    description=desc,
                    system_prompt="You are a helpful assistant.",
                    model_id=model.id,
                    temperature=0.7,
                    max_tokens=2048,
                    owner_id=user.id,
                    is_published=True
                )
                db.add(a)
                db.flush()
                dummy_agents.append(a)
            else:
                dummy_agents.append(exist)

        # 7. Clear previous usage records to start fresh
        print("Clearing previous usage records...")
        db.query(UsageRecord).delete()
        db.flush()

        # 8. Generate usage records for the last 30 days
        print("Seeding usage records for the last 30 days...")
        now = datetime.utcnow()
        count = 0
        
        for i in range(30):
            day = now - timedelta(days=i)
            # Create between 3 and 10 usage records per day
            num_records = random.randint(3, 10)
            for _ in range(num_records):
                u = random.choice(dummy_users)
                a = random.choice(dummy_agents)
                tokens_in = random.randint(200, 4000)
                tokens_out = random.randint(100, 3000)
                
                # Calculate realistic cost
                cost = (tokens_in * 0.005 + tokens_out * 0.015) / 1000
                
                rec = UsageRecord(
                    user_id=u.id,
                    agent_id=a.id,
                    model_id=model.id,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    cost_usd=cost,
                    created_at=day - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                )
                db.add(rec)
                count += 1
                
        db.commit()
        print(f"Successfully seeded {count} usage records across {len(dummy_users)} users and {len(dummy_agents)} agents!")
        
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
