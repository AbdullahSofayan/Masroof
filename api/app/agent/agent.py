from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.agent.context import Scope
from app.agent.llm import chat_model_names, get_chat_model
from app.agent.prompt import build_system_prompt
from app.agent.schemas import ChatMessage, ChatResponse
from app.agent.tools import build_tools
from app.core.config import settings


def build_agent(scope: Scope, model_name: str):
    return create_agent(
        model=get_chat_model(model_name),
        tools=build_tools(scope),
        system_prompt=build_system_prompt(scope),
    )


def run_chat(scope: Scope, messages: list[ChatMessage]) -> ChatResponse:
    history = messages[-settings.agent_max_history_messages :]
    payload = []
    for item in history:
        payload.append(
            HumanMessage(content=item.content)
            if item.role == "user"
            else AIMessage(content=item.content)
        )
    last_error = None
    for model_name in chat_model_names():
        try:
            agent = build_agent(scope, model_name)
            result = agent.invoke(
                {"messages": payload},
                config={"recursion_limit": settings.agent_max_tool_calls * 2 + 2},
            )
            result_messages = result.get("messages", [])
            reply = ""
            used = []
            for message in result_messages:
                if isinstance(message, ToolMessage) and message.name:
                    used.append(message.name)
                if isinstance(message, AIMessage) and isinstance(message.content, str):
                    reply = message.content
            if not reply:
                reply = "I could not produce an answer from the available Masroof data."
            return ChatResponse(reply=reply, tools_used=list(dict.fromkeys(used)))
        except Exception as exc:
            last_error = exc
            status_code = getattr(exc, "status_code", None)
            response = getattr(exc, "response", None)
            status_code = status_code or getattr(response, "status_code", None)
            # Retry configured models for provider throttling/server errors or
            # unavailable model/tool-calling implementations.
            if status_code and status_code not in (429, 500, 502, 503, 504):
                break
    raise RuntimeError(f"All configured chat models failed: {last_error}")
