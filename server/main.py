import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        # Maps room_id -> { "connections": { role: ws }, "settings": { "time_limit": int } }
        self.rooms: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, client_id: str, time_limit: int = 60):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {
                "connections": {},
                "settings": {"time_limit": time_limit}
            }
        
        connections = self.rooms[room_id]["connections"]
        
        # Determine player role
        if "player1" not in connections:
            role = "player1"
        elif "player2" not in connections:
            role = "player2"
        else:
            # Room full, reject connection natively
            await websocket.send_json({"type": "error", "message": "Room is full"})
            await websocket.close()
            return None
        
        connections[role] = websocket
        
        # Notify player of their role and settings
        await websocket.send_json({
            "type": "role_assignment", 
            "role": role,
            "settings": self.rooms[room_id]["settings"],
            "players": list(connections.keys())
        })
        
        # Notify others that someone joined
        await self.broadcast(room_id, {
            "type": "player_joined", 
            "role": role,
            "players": list(connections.keys())
        })
        
        return role

    def get_role(self, room_id: str, websocket: WebSocket) -> str | None:
        if room_id in self.rooms:
            for role, ws in self.rooms[room_id]["connections"].items():
                if ws == websocket:
                    return role
        return None

    async def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id not in self.rooms:
            return
            
        connections = self.rooms[room_id]["connections"]
        
        # Find the current role of this websocket
        current_role = None
        for r, ws in connections.items():
            if ws == websocket:
                current_role = r
                break
        
        if not current_role:
            return

        # Remove the found role
        del connections[current_role]
        
        # Host Migration: If player1 left but player2 is still here, promote player2 to player1
        if current_role == "player1" and "player2" in connections:
            player2_ws = connections.pop("player2")
            connections["player1"] = player2_ws
            # Notify the new player1
            await player2_ws.send_json({
                "type": "host_migration",
                "role": "player1",
                "players": list(connections.keys())
            })
        
        if not connections:
            self.rooms.pop(room_id, None)
        else:
            # Notify remaining players about the departure and new player list
            await self.broadcast(room_id, {
                "type": "player_disconnected",
                "role": current_role,
                "players": list(connections.keys())
            })

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.rooms:
            for role, ws in self.rooms[room_id]["connections"].items():
                await ws.send_json(message)
                
    async def send_to_opponent(self, room_id: str, sender_role: str, message: dict):
        if room_id in self.rooms:
            connections = self.rooms[room_id]["connections"]
            opponent_role = "player2" if sender_role == "player1" else "player1"
            if opponent_role in connections:
                await connections[opponent_role].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str, time_limit: int = 60):
    role = await manager.connect(websocket, room_id, client_id, time_limit)
    if not role:
        return
        
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Dynamic Role: Re-check current role in case of promotion (host_migration)
            current_role = manager.get_role(room_id, websocket)
            if not current_role:
                break # Should not happen unless room is destroyed
            
            # Message Handlers
            msg_type = message.get("type")
            
            if msg_type == "update_settings" and current_role == "player1":
                if room_id in manager.rooms:
                    manager.rooms[room_id]["settings"].update(message.get("settings", {}))
                    await manager.broadcast(room_id, {
                        "type": "settings_updated",
                        "settings": manager.rooms[room_id]["settings"]
                    })

            elif msg_type == "start_game" and current_role == "player1":
                if room_id in manager.rooms:
                    # Check if both players are connected
                    if len(manager.rooms[room_id]["connections"]) == 2:
                        await manager.broadcast(room_id, {
                            "type": "game_start",
                            "settings": manager.rooms[room_id]["settings"]
                        })

            elif msg_type == "restart_request":
                # Clear game state on server (if any) and notify to go back to lobby
                await manager.broadcast(room_id, {"type": "lobby_return"})

            elif msg_type in ["game_state_update", "game_over"]:
                # Forward game state updates to the opponent
                message["sender"] = current_role
                await manager.send_to_opponent(room_id, str(current_role), message)
                
    except WebSocketDisconnect:
        await manager.disconnect(room_id, websocket)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Multiplayer 2048 Server"}
