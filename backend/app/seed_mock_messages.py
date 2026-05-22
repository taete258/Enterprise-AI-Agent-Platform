"""
Seed 150 mock messages into an existing session for pagination testing.
Usage:
  python -m app.seed_mock_messages [session_id]
  (if no session_id given, picks the first available session)
"""
import sys
import random
from datetime import datetime, timedelta
from app.db.session import SessionLocal
from app.models.chat import ChatSession, Message

MOCK_PAIRS = [
    ("สวัสดีครับ ช่วยอธิบาย Python decorator ให้หน่อยได้ไหม?",
     "แน่นอนครับ! Decorator ใน Python คือ function ที่ wraps function อื่น เพื่อเพิ่ม behavior โดยไม่แก้ไข source code ตัวอย่างเช่น `@log_time` จะวัดเวลา execution ของฟังก์ชันที่ถูก decorate ครับ"),
    ("แล้ว @staticmethod กับ @classmethod ต่างกันยังไง?",
     "@staticmethod ไม่รับ self หรือ cls เหมาะสำหรับ utility function ที่ไม่ต้องการ instance\n@classmethod รับ cls แทน self ใช้เมื่อต้องการเข้าถึง class attributes หรือสร้าง alternative constructor ครับ"),
    ("ขอตัวอย่าง async/await หน่อยได้ไหม?",
     "ได้เลยครับ:\n```python\nimport asyncio\n\nasync def fetch_data(url: str) -> dict:\n    await asyncio.sleep(1)  # simulate network\n    return {\"url\": url, \"data\": \"...\"}\n\nasync def main():\n    results = await asyncio.gather(\n        fetch_data(\"https://api.example.com/a\"),\n        fetch_data(\"https://api.example.com/b\"),\n    )\n    print(results)\n```\nใช้ `gather()` เพื่อรัน coroutines พร้อมกันครับ"),
    ("TypeScript interface กับ type ใช้ต่างกันยังไง?",
     "ความแตกต่างหลักๆ:\n- **interface**: extend ได้, merge declarations ได้, เหมาะกับ object shapes\n- **type**: flexible กว่า รองรับ union/intersection/primitive, ไม่ merge declarations\n\nแนะนำใช้ `interface` สำหรับ public API, `type` สำหรับ utility types ครับ"),
    ("React useCallback กับ useMemo ควรใช้เมื่อไหร่?",
     "ใช้เมื่อ:\n- **useCallback**: prevent re-creation ของ function reference ที่ส่งเป็น prop ให้ child component ที่ memoized\n- **useMemo**: cache ผลลัพธ์ของ expensive computation\n\nแต่อย่า over-optimize ครับ ควรใช้เมื่อ profiler บอกว่ามี performance issue จริงๆ"),
    ("SQL Index ทำงานอย่างไร?",
     "Index คือ data structure (ส่วนใหญ่เป็น B-Tree) ที่ฐานข้อมูลสร้างขึ้นเพื่อเร็วขึ้นในการ query\n\nเหมือน index หลังหนังสือ แทนที่จะอ่านทุกหน้า ก็เปิดไปที่ index ก่อน\n\n**ควรสร้าง index บน**: columns ที่ใช้ใน WHERE, JOIN, ORDER BY\n**ระวัง**: index ทำให้ INSERT/UPDATE ช้าลงเล็กน้อยครับ"),
    ("Docker กับ VM ต่างกันยังไง?",
     "**VM**: virtualize hardware ทั้งหมด มี full OS แต่ละ VM → หนักกว่า, startup นานกว่า\n**Docker**: share OS kernel, isolate ที่ process level → เบากว่ามาก, startup เป็น ms\n\nใช้ Docker เมื่อต้องการ lightweight isolation, ใช้ VM เมื่อต้องการ full isolation หรือ OS ต่างกันครับ"),
    ("Git rebase กับ merge ต่างกันยังไง?",
     "**merge**: สร้าง merge commit ที่รวม history ของทั้งสอง branch ไว้\n**rebase**: ย้าย commits ของ branch ไปต่อท้าย branch อื่น ทำให้ history ตรงและสะอาดกว่า\n\nใช้ merge สำหรับ feature branches, rebase สำหรับ keeping up-to-date กับ main ครับ แต่อย่า rebase commits ที่ push ไปแล้วนะครับ"),
    ("ช่วย explain CAP theorem ให้หน่อยได้ไหม?",
     "CAP theorem บอกว่า distributed system เลือกได้แค่ 2 ใน 3:\n\n- **C**onsistency: ทุก node เห็นข้อมูลเหมือนกัน\n- **A**vailability: ทุก request ได้รับ response (ไม่ error)\n- **P**artition tolerance: ทำงานได้แม้ network แตก\n\nในทางปฏิบัติ P มักจำเป็น ดังนั้นต้องเลือกระหว่าง CP (เช่น MongoDB) กับ AP (เช่น Cassandra) ครับ"),
    ("Big O notation คืออะไร ยกตัวอย่างหน่อย?",
     "Big O บอก worst-case time complexity ของ algorithm:\n\n| Notation | ชื่อ | ตัวอย่าง |\n|---|---|---|\n| O(1) | Constant | Array access |\n| O(log n) | Logarithmic | Binary search |\n| O(n) | Linear | Linear search |\n| O(n log n) | Linearithmic | Merge sort |\n| O(n²) | Quadratic | Bubble sort |\n| O(2ⁿ) | Exponential | Fibonacci naive |\n\nเป้าหมายคือทำให้ต่ำที่สุดเท่าที่เป็นไปได้ครับ"),
    ("REST API กับ GraphQL ต่างกันยังไง?",
     "**REST**: หลาย endpoints, server กำหนด response shape, ง่ายต่อ caching\n**GraphQL**: endpoint เดียว, client กำหนดว่าต้องการ field ไหน, แก้ปัญหา over/under-fetching\n\nเลือก REST เมื่อ API ตรงไปตรงมา, เลือก GraphQL เมื่อ frontend มีหลาย clients ที่ต้องการข้อมูลต่างกัน"),
    ("ช่วยอธิบาย SOLID principles ให้หน่อยได้ไหม?",
     "SOLID ย่อมาจาก:\n\n**S** - Single Responsibility: class มีหน้าที่เดียว\n**O** - Open/Closed: เปิดสำหรับ extend, ปิดสำหรับ modify\n**L** - Liskov Substitution: subclass ใช้แทน superclass ได้\n**I** - Interface Segregation: ไม่บังคับ implement methods ที่ไม่ใช้\n**D** - Dependency Inversion: depend on abstractions, ไม่ใช่ concretions\n\nตามหลักนี้ทำให้ code maintainable และ testable ครับ"),
    ("WebSocket กับ HTTP polling ต่างกันยังไง?",
     "**HTTP Polling**: client ส่ง request ทุกๆ N วินาที เพื่อถามว่ามีข้อมูลใหม่ไหม → wasteful\n**Long Polling**: client ส่ง request แล้ว server hold จนมีข้อมูล → better\n**WebSocket**: full-duplex connection ถาวร ส่งข้อมูล 2 ทางได้ทันที → เหมาะสุดสำหรับ real-time\n\nใช้ WebSocket เมื่อต้องการ real-time chat, live updates, gaming ครับ"),
    ("JWT token ทำงานอย่างไร?",
     "JWT (JSON Web Token) ประกอบด้วย 3 ส่วนคั่นด้วย `.`:\n\n1. **Header**: algorithm ที่ใช้ (เช่น HS256)\n2. **Payload**: claims (user_id, role, exp, etc.)\n3. **Signature**: HMAC ของ header+payload ด้วย secret key\n\nServer verify ด้วยการ recompute signature ถ้าตรงกัน = valid\n**ข้อควรระวัง**: ข้อมูลใน payload ไม่ได้ encrypted แค่ encoded ครับ"),
    ("Microservices กับ Monolith เลือกอะไรดี?",
     "**Monolith**: เริ่มต้นง่าย, deploy ง่าย, debug ง่าย เหมาะกับ team เล็กหรือ early stage\n**Microservices**: scale แต่ละ service ได้อิสระ, deploy แยกกัน แต่ซับซ้อนกว่ามาก\n\nคำแนะนำ: เริ่มด้วย Monolith ก่อน แยกเป็น Microservices เมื่อมี pain point ชัดเจนจาก scale หรือ team size ครับ"),
]

def seed(session_id: int | None = None, count: int = 150):
    db = SessionLocal()
    try:
        if session_id:
            session = db.get(ChatSession, session_id)
            if not session:
                print(f"Session {session_id} not found")
                return
        else:
            session = db.query(ChatSession).filter(ChatSession.is_archived == False).first()
            if not session:
                print("No active session found. Open a chat first.")
                return

        print(f"Seeding {count} messages into session {session.id} ('{session.title}')...")

        base_time = datetime.utcnow() - timedelta(hours=count // 2)
        pairs_count = count // 2
        messages = []
        for i in range(pairs_count):
            pair = MOCK_PAIRS[i % len(MOCK_PAIRS)]
            t = base_time + timedelta(minutes=i * 2)
            messages.append(Message(
                session_id=session.id,
                role="user",
                content=f"[#{i+1}] {pair[0]}",
                tokens_in=random.randint(20, 80),
                tokens_out=0,
                created_at=t,
            ))
            messages.append(Message(
                session_id=session.id,
                role="assistant",
                content=pair[1],
                tokens_in=0,
                tokens_out=random.randint(80, 400),
                created_at=t + timedelta(seconds=3),
            ))

        db.add_all(messages)
        db.commit()
        print(f"✓ Added {len(messages)} messages. Session now has messages from the past {pairs_count * 2} minutes.")
        print(f"  → Open: /chat/{session.agent_id}?session_id={session.id}")

    finally:
        db.close()


if __name__ == "__main__":
    sid = int(sys.argv[1]) if len(sys.argv) > 1 else None
    cnt = int(sys.argv[2]) if len(sys.argv) > 2 else 150
    seed(sid, cnt)
