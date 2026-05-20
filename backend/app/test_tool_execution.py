import json
import unittest
from unittest.mock import patch, MagicMock
import httpx

from app.services.tools import safe_eval, execute_tool
from app.models import Tool

class TestToolExecution(unittest.TestCase):
    def test_safe_eval_valid(self):
        self.assertEqual(safe_eval("2 + 3 * 4"), "14")
        self.assertEqual(safe_eval("sin(pi / 2)"), "1.0")
        self.assertEqual(safe_eval("round(10.6)"), "11")

    def test_safe_eval_errors(self):
        self.assertTrue("Error" in safe_eval("1 / 0"))
        res = safe_eval("__import__('os').system('ls')")
        self.assertTrue("Error" in res or "name '__import__' is not defined" in res)

    def test_execute_calculator(self):
        db_mock = MagicMock()
        res = execute_tool(db_mock, "calculator", {"expression": "5 * 5"}, "{}")
        self.assertEqual(res, "25")

    @patch("httpx.Client.request")
    def test_execute_api_tool(self, mock_req):
        db_mock = MagicMock()
        tool = Tool(
            key="get_weather",
            name="Weather",
            description="Get weather info",
            type="api",
            url="/api/mock/weather",
            method="GET",
            headers="{}",
            schema_json="{}"
        )
        db_mock.scalar.return_value = tool

        mock_response = httpx.Response(200, text=json.dumps({"temp": 30, "condition": "Rainy"}))
        mock_req.return_value = mock_response

        res = execute_tool(db_mock, "get_weather", {"city": "Bangkok"}, "{}")
        
        self.assertEqual(res, json.dumps({"temp": 30, "condition": "Rainy"}))
        mock_req.assert_called_once_with(
            "GET",
            "http://localhost:8000/api/mock/weather",
            headers={},
            params={"city": "Bangkok"}
        )

    @patch("httpx.Client.request")
    def test_execute_api_tool_with_overrides(self, mock_req):
        db_mock = MagicMock()
        tool = Tool(
            key="hr_leaves",
            name="HR Leaves",
            description="HR info",
            type="api",
            url="/api/mock/hr/leaves",
            method="POST",
            headers='{"Authorization": "Bearer global-key"}',
            schema_json="{}"
        )
        db_mock.scalar.return_value = tool

        mock_response = httpx.Response(200, text="Success")
        mock_req.return_value = mock_response

        agent_config = json.dumps({
            "base_url": "https://internal-hr.corp",
            "headers": {
                "Authorization": "Bearer specific-agent-key",
                "X-Custom-Header": "Value"
            }
        })

        res = execute_tool(db_mock, "hr_leaves", {"employee_id": 45}, agent_config)
        
        self.assertEqual(res, "Success")
        mock_req.assert_called_once_with(
            "POST",
            "https://internal-hr.corp/api/mock/hr/leaves",
            headers={
                "Authorization": "Bearer specific-agent-key",
                "X-Custom-Header": "Value"
            },
            json={"employee_id": 45}
        )

if __name__ == "__main__":
    unittest.main()
