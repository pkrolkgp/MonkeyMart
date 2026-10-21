# Defold WebSocket bridge — status: integration prototype

This folder contains original helper code. It does NOT include or replace the recovered Monkey Mart game, scenes, scripts, or graphics.

Dependencies:
- official Defold extension-websocket: https://github.com/defold/extension-websocket
- built-in Defold json module
- multiplayer/server backend

The native extension provides websocket.connect(url, params, callback),
websocket.send(connection, json, { type=websocket.DATA_TYPE_TEXT }) and
websocket.disconnect(connection).
Reference: https://defold.com/extension-websocket/websocket_api/

Example integration into a Defold script:

    local Coop = require("multiplayer.defold.coop_client")
    function init(self)
        self.coop = Coop.new({
            url = "ws://127.0.0.1:8080",
            name = "Gracz 1",
            skin = "monkey1",
            -- room = "ABC123", -- optional: join existing room
            on_event = function(msg)
                if msg.type == "welcome" then print("Room", msg.room) end
                -- TODO: map player_moved to GameState.players
                -- TODO: map store_changed to local GameState inventory/UI
            end,
        })
        self.coop:connect()
    end
    function final(self) self.coop:disconnect() end

Available methods after welcome: move(x,y), skin_change(skin),
transfer("collect"|"drop", product_name, quantity), snapshot(), disconnect().

Recovered original integration points observed during analysis:
main/screen_game/game.script initializes gameState;
GameState:addPlayer creates player objects;
GameState:update handles their simulation;
GameState:collectFood and GameState:dropFood mutate locally held goods.
These original game files are NOT reproduced here. No game integration
is claimed until the original Defold project can be built successfully.
