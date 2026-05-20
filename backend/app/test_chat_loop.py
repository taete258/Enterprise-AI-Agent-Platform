import json
import unittest
from unittest.mock import patch, MagicMock

from app.models import Agent, LLMModel, LLMProvider, ChatSession, Message
from app.services.chat import run_chat
from app.providers.base import ChatCompletion

class TestChatLoopOrchestration(unittest.TestCase):
    @patch("app.services.chat.get_client")
    @patch("app.services.chat.record_usage")
    @patch("app.services.chat.retrieve")
    def test_run_chat_orchestration_loop(self, mock_retrieve, mock_record_usage, mock_get_client):
        # 1. Mock DB Session
        db_mock = MagicMock()
        
        # Setup mocks for retrieve (RAG)
        mock_retrieve.return_value = [] # no RAG hits

        # 2. Setup mock models
        agent = Agent(
            id=1,
            model_id=1,
            system_prompt="You are a helper",
            temperature=0.7,
            max_tokens=1000
        )
        model = LLMModel(
            id=1,
            provider_id=1,
            model_id="gpt-4o",
            is_active=True,
            input_cost_per_1k=0.01,
            output_cost_per_1k=0.03
        )
        provider = LLMProvider(
            id=1,
            kind="openai",
            is_active=True
        )
        session = ChatSession(id=1, messages=[])

        # Define DB mock lookup
        def db_get_side_effect(model_cls, pk):
            if model_cls == LLMModel and pk == 1:
                return model
            if model_cls == LLMProvider and pk == 1:
                return provider
            return None
        db_mock.get.side_effect = db_get_side_effect
        db_mock.scalars.return_value.all.return_value = [] # no custom bound tools

        # 3. Setup mock LLM Client behavior (2-turn chat loop)
        client_mock = MagicMock()
        mock_get_client.return_value = client_mock

        # First turn: requests calculator execution
        turn_1_completion = ChatCompletion(
            content=None,
            tool_calls=[{
                "id": "call_abc",
                "type": "function",
                "function": {
                    "name": "calculator",
                    "arguments": '{"expression": "40 + 2"}'
                }
            }],
            tokens_in=15,
            tokens_out=25
        )
        # Second turn: returns final answer
        turn_2_completion = ChatCompletion(
            content="The calculation result is 42.",
            tool_calls=None,
            tokens_in=35,
            tokens_out=12
        )
        client_mock.chat.side_effect = [turn_1_completion, turn_2_completion]

        # 4. Execute the loop
        assistant_msg, citations = run_chat(
            db=db_mock,
            user_id=10,
            agent=agent,
            session=session,
            user_text="What is 40 + 2?",
            apply_pii_mask=False
        )

        # 5. Assertions
        # Verify the final assistant response content
        self.assertEqual(assistant_msg.content, "The calculation result is 42.")
        
        # Verify that total tokens in/out reflect the sum of all loop iterations
        self.assertEqual(assistant_msg.tokens_in, 50)  # 15 + 35
        self.assertEqual(assistant_msg.tokens_out, 37) # 25 + 12

        # Verify that record_usage was called with the accumulated tokens
        mock_record_usage.assert_called_once_with(
            db_mock,
            user_id=10,
            agent_id=1,
            model_id=1,
            tokens_in=50,
            tokens_out=37,
            input_cost_per_1k=0.01,
            output_cost_per_1k=0.03
        )

        # Verify that intermediate database adds happened (user, assistant-tool_call, tool-response, assistant-final)
        added_messages = [call[0][0] for call in db_mock.add.call_args_list if isinstance(call[0][0], Message)]
        
        roles = [m.role for m in added_messages]
        self.assertEqual(roles, ["user", "assistant", "tool", "assistant"])
        
        # The user message
        self.assertEqual(added_messages[0].content, "What is 40 + 2?")
        
        # The assistant tool call
        self.assertEqual(added_messages[1].role, "assistant")
        self.assertTrue("call_abc" in added_messages[1].tool_calls)
        
        # The tool response
        self.assertEqual(added_messages[2].role, "tool")
        self.assertEqual(added_messages[2].content, "42")
        self.assertEqual(added_messages[2].tool_call_id, "call_abc")

if __name__ == "__main__":
    unittest.main()
