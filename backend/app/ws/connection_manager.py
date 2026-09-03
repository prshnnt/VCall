from fastapi import WebSocket


class ConnectionManager:
    """Keeps one active WebSocket per logged-in user_id.

    This connection stays open for the whole session (not just during a
    call) so that a user can receive an incoming-call notification or a
    chat message at any time -- like a phone that's always listening,
    not just when you're mid-call.
    """

    def __init__(self) -> None:
        self.active: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        # If the same user opens a second tab/device, the newest wins.
        old = self.active.get(user_id)
        if old is not None and old is not ws:
            try:
                await old.close()
            except Exception:
                pass
        self.active[user_id] = ws

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        if self.active.get(user_id) is ws:
            del self.active[user_id]

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active

    async def send_json(self, user_id: str, data: dict) -> bool:
        """Returns True if the message was actually delivered."""
        ws = self.active.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_json(data)
            return True
        except Exception:
            return False


manager = ConnectionManager()
