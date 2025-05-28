# BrickdUpBackNd

## Overview

Currently short polling

**Assumptions:**
* LobbyId, PlayerId, pollingFlag, isAdmin, Leaderboard is stored on client and used to inform what displays on the website
* Player search time is all handled by website, then passed to server with flag 3
* Server cookie is only used when the client wants to retrieve their player details

## Endpoints
## /lobby

### /create
POST: 
* request body: { "max_players": , "name": , "num_rounds": }
* response body: { "id": adminId, "lobbyId": lobbyId, "cookie": playerCookie, "serverCookie": serverCookie, "admin": true }

### /list
GET: 
* response body: { lobbyId[] }

### /join/:lobbyId
POST: 
* request body: { "playerName": }
* response body: { "id": playerId, "cookie": cookie, "server_cookie": serverCookie, admin: false }

### /join
POST: 
* request body: { lobbyId, playerName }
* response body: { "id": playerId, "cookie": cookie, "server_cookie": serverCookie, admin: false }

### /start
POST: 
* request body: { "lobbyId": , "playerId": , "cookie": }
* response body: if playerId == admin Id, { started: true }  
  else, { error: "invalid permissions" }

### /retrieve
POST:
* request body: { "cookie": , "serverCookie": }
* response body: { "lobbyId": lobbyId, "playerId": playerId, "searchTime": lastSearchTime, "pollingFlag": lastPollingFlag }

### /pollme
There may be issues if the polling flag is way ahead, inshallah these present themselves when we test 🙏

See diagram for how it works (or ask Danyal available 9-5 Mon-Thurs):
Check front page

## Test case steps:
Step 1:
* { "lobbyId": "0", "playerId": "0", "pollingFlag": 1 }
* { "lobbyId": "0", "playerId": "1", "pollingFlag": 1 }

Step 2:
* { "lobbyId": "0", "playerId": "0", "pollingFlag": 1 }
* { "lobbyId": "0", "playerId": "1", "pollingFlag": 1 }

Step 3:
* { "lobbyId": "0", "playerId": "0", "pollingFlag": 3, "searchTime": 9 }
* { "lobbyId": "0", "playerId": "1", "pollingFlag": 3, "searchTime": 4 }

Step 4:
* { "lobbyId": "0", "playerId": "0", "pollingFlag": 4 }
* { "lobbyId": "0", "playerId": "1", "pollingFlag": 4 }

Step 4.5:
* { "lobbyId": "0", "playerId": "0", "pollingFlag": 1 }
* { "lobbyId": "0", "playerId": "1", "pollingFlag": 5 }  //not necessary
