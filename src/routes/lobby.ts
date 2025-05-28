import express, { NextFunction, Request, Response } from "express";
import { Lobbies, Lobby, Player } from "../types";

const router = express.Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const MAX_STALE_TIME = 3500;
const SHOW_TIME = 2000;
const WAIT_TIME = 4000;
const FIND_TIME = 10 * 1000;
const INCORRECT_FIND_TIME = 12000;

let lobbies: Lobbies = {};

const generateLobbyId = (): string => {
  return Math.random().toString(36).substring(7);
};

const generatePlayerId = (): string => {
  return Math.random().toString(36).substring(7);
};

router.post("/create", (req: Request, res: Response) => {
  let { max_players, name, num_rounds } = req.body;

  if (num_rounds == 0) {
    num_rounds = 5;
  }

  const lobbyId = generateLobbyId();
  const adminId = generatePlayerId();
  const randomiser = generateArrayRandomNumbers(num_rounds || 5);

  lobbies[lobbyId] = {
    id: lobbyId,
    adminId: adminId,
    players: {
      [adminId]: {
        id: adminId,
        name: name,
        searchTime: 0,
        lobbyId: lobbyId,
        pollingFlag: 0,
        score: 0,
        admin: true,
        lastPollTime: new Date().getTime(),
        cumScore: 0,
      },
    },
    maxPlayers: max_players || 128,
    numRounds: num_rounds || 5,
    started: false,
    roundCount: 0,
    leaderboard: [[name, 0, 0]],
    serverFlag: 0,
    imageRandomiser: randomiser,
    waitingTimer: 0,
    maxSearchTime: FIND_TIME,
  };

  res.json({
    id: adminId,
    lobbyId: lobbyId,
    admin: true,
    imageRandomiser: randomiser,
  });
});

router.post("/join/:lobbyId", (req: Request, res: Response) => {
  const { lobbyId } = req.params;
  const { playerName } = req.body;

  if (!lobbies[lobbyId]) {
    res.status(404).json({ error: "Lobby not found" });
  }

  const currLobby = lobbies[lobbyId];
  const playerCount = Object.keys(currLobby.players).length;

  if (!currLobby) {
    res.status(404).json({ error: "Lobby not found" });
  } else if (currLobby.started) {
    res.status(404).json({ error: "Game already started" });
  } else if (currLobby.maxPlayers == playerCount) {
    res.status(404).json({ error: "No more room in lobby" });
  } else {
    const playerId = generatePlayerId();

    lobbies[lobbyId].players[playerId] = {
      id: playerId,
      name: playerName,
      searchTime: 0,
      lobbyId: lobbyId,
      pollingFlag: 0,
      score: 0,
      admin: false,
      lastPollTime: new Date().getTime(),
      cumScore: 0,
    };

    lobbies[lobbyId].leaderboard.push([playerName, 0, 0]);

    res.json({
      id: playerId,
      admin: false,
      imageRandomiser: currLobby.imageRandomiser,
    });
  }
});

router.post("/start", (req: Request, res: Response) => {
  const { lobbyId, playerId } = req.body;
  const adminId = lobbies[lobbyId].adminId;

  if (adminId == playerId) {
    lobbies[lobbyId].started = true;
    res.json({ started: true });
  } else {
    res.json({ error: "invalid permissions" });
  }
});

router.post("/players", (req: Request, res: Response) => {
  const { lobbyId } = req.body;
  const currLobby = lobbies[lobbyId];

  if (!!currLobby) {
    const playerNames = Object.values(currLobby.players).map((playerInfo) => ({
      playerName: playerInfo.name,
      playerId: playerInfo.id,
    }));
    res.json(playerNames);
  } else {
    res.json({ error: "lobby doesn't exist" });
  }
});

router.post("/pollme", (req: Request, res: Response) => {
  let { lobbyId, playerId, searchTime, pollingFlag, lastPollTime } = req.body;
  const currLobby: Lobby = lobbies[lobbyId];
  const isAdmin: boolean = currLobby.players[playerId].admin;

  // update last poll time on server when a poll time is send
  if (lastPollTime) {
    currLobby.players[playerId].lastPollTime = lastPollTime;
  }
  // kick stale players
  kickStalePlayers(currLobby);

  // count stuff to be used below
  const playersInLobbyCount = countPlayersWithFlag(currLobby, 0);
  const playersWaitingCount = countPlayersWithFlag(currLobby, 4);
  const playersWaitedCount = countPlayersWithFlag(currLobby, 5);
  const playersJoinedRoundCount = countPlayersWithFlag(currLobby, 1); // players joined round
  const playerCount = Object.keys(currLobby.players).length;

  // Check if game is over
  if (currLobby.started && currLobby.roundCount == currLobby.numRounds) {
    // Set game to not started
    currLobby.started = false;
    // Set game flag to GAME_ENDED
    currLobby.serverFlag = 6;
  }

  // If game is over on server
  if (currLobby.serverFlag == 6) {
    // set player to game ended
    pollingFlag = 6;
    // console.log("##### GAME OVER #####");
  }

  // When all players have joined round
  // const playersJoinedRoundCount = countPlayersWithFlag(currLobby, 1); // players joined round
  if (currLobby.started && playersJoinedRoundCount == playerCount) {
    // set the server to round started
    currLobby.serverFlag = 2;
  }

  if (currLobby.started && playersWaitingCount == playerCount) {
    // Set the waiting timer if 0, otherwise it has been set
    if (currLobby.waitingTimer == 0) {
      currLobby.waitingTimer = new Date().getTime();
    }
  }

  // player tried rejoining when the game has started
  if (currLobby.serverFlag != 0 && pollingFlag == 0) {
    pollingFlag = -1;
  }

  // When all players have submitted their time set server to FINSIHED_ROUND
  // const playersWaitingCount = countPlayersWithFlag(currLobby, 4);
  if (currLobby.started && playersWaitedCount == playerCount) {
    // Update round count
    currLobby.roundCount++;
    // console.log(`moving forward a round`);
    currLobby.maxSearchTime = calculateShowTime(currLobby);
    // Set the server to finished round
    currLobby.serverFlag = 3;
  }
  // If player in lobby and game started/ game restarted and player still in game_ended state
  if (
    currLobby.started &&
    currLobby.serverFlag == 0 &&
    (pollingFlag == 0 || pollingFlag == 6)
  ) {
    // set player to joined round
    pollingFlag = 1;
    // console.log(`##### Player ${playerId} joined the lobby #####`);
  }

  // When player in round polls server in round started state (all players joined round)
  else if (currLobby.started && currLobby.serverFlag == 2 && pollingFlag == 1) {
    // set player to round started - this is when their timer starts
    pollingFlag = 2;
    // console.log(`##### Player ${playerId} has started their round #####`);
  }

  // When player has finished round they set their polling flag to 3
  // First poll from player with this flag has server consume this data and change to waiting flag
  else if (
    currLobby.started &&
    //   (currLobby.serverFlag == 2 || currLobby.serverFlag == 3) &&
    pollingFlag == 3
  ) {
    const currPlayer = currLobby.players[playerId];
    // Save player time:
    currPlayer.searchTime = searchTime;
    currPlayer.cumScore += searchTime - SHOW_TIME;
    // Update player score:
    let score = 0;
    if (currPlayer.searchTime != 2000 + currLobby.maxSearchTime) {
      score = playerCount - playersWaitingCount;
      currPlayer.score += score;
    }
    // Tell lobby about score:
    // if (score != 0) {
    const currPlayers = currLobby.players;
    const scoresSorted: [
      playerName: string,
      score: number,
      cumScore: number
    ][] = Object.keys(currPlayers).map((playerId) => [
      currPlayers[playerId].name,
      currPlayers[playerId].score,
      currPlayers[playerId].cumScore,
    ]);
    scoresSorted.sort(compareNumAsc);
    currLobby.leaderboard = scoresSorted.reverse();
    // }

    // set player to waiting
    pollingFlag = 4;
    // console.log(
    //   `##### Player ${playerId} has submitted ${searchTime}, gaining ${score} points, now waiting #####`
    // );
  }

  // when all players are waiting the waiting clock starts, when all waited need to set this back to 0
  else if (
    currLobby.started &&
    currLobby.serverFlag == 2 &&
    pollingFlag == 4 &&
    // non default wait time
    currLobby.waitingTimer > 0 &&
    timeAbsDiff(currLobby.waitingTimer, lastPollTime) > WAIT_TIME
  ) {
    // Set player to waited complete
    pollingFlag = 5;
    // console.log(`##### Player ${playerId} has waited #####`);

    // once waited and everyone else
  } else if (
    currLobby.started &&
    currLobby.serverFlag == 3 &&
    pollingFlag == 5
  ) {
    // Server waiting clock set to zero again
    currLobby.waitingTimer = 0;
    // Set player to joined round
    pollingFlag = 1;
    // console.log(
    //   `##### Player ${playerId} has finished waiting and being sent for the next wound #####`
    // );
  }

  // Finally:
  // 1. Update player flag on server
  currLobby.players[playerId].pollingFlag = pollingFlag;
  // 3. Tell player what players they're with
  const players = Object.values(currLobby.players).map((playerInfo) => ({
    playerName: playerInfo.name,
    playerId: playerInfo.id,
  }));

  res.json({
    pollingFlag: pollingFlag,
    players: players,
    leaderboard: currLobby.leaderboard,
    admin: isAdmin,
    started: currLobby.started,
    imageRandomiser: currLobby.imageRandomiser,
    roundCount: currLobby.roundCount,
    score: currLobby.players[playerId].score,
    maxSearchTime: currLobby.maxSearchTime,
    // searchTime: currLobby.players[playerId].searchTime,
  });
});

router.get("/list", (req: Request, res: Response) => {
  res.json(Object.keys(lobbies));
});

function countPlayersWithFlag(lobby: Lobby, flag: number): number {
  return Object.values(lobby.players).filter(
    (player) => player.pollingFlag == flag
  ).length;
}

// Sorts from lowers to highest
function compareNumAsc(
  a: [string, number, number],
  b: [string, number, number]
) {
  if (a[1] < b[1]) {
    return -1;
  } else if (a[1] > b[1]) {
    return 1;
  } else if (a[1] == b[1]) {
    if (a[2] < b[2]) {
      return 1;
    } else if (a[2] > b[2]) return -1;
  }
  return 0;
}

function generateArrayRandomNumbers(numRounds: number) {
  const randomArray = [];
  for (let i = 0; i < numRounds; i++) {
    let randomNumber = Math.random();
    randomArray.push(randomNumber);
  }
  return randomArray;
}

function kickStalePlayers(lobby: Lobby) {
  const currTime = new Date().getTime(); //time in ms since the EPOCH
  const players = lobby.players;

  lobby.players = Object.keys(players)
    .filter((playerId) => {
      return (
        timeAbsDiff(players[playerId].lastPollTime, currTime) < MAX_STALE_TIME
      );
    })
    .reduce((res: { [playerId: string]: Player }, playerId) => {
      res[playerId] = players[playerId];
      return res;
    }, {});
}

// function cullStaleLobbies() {
//   lobbies = Object.keys(lobbies)
//     .filter((lobbyId) => {
//       return lobbies[lobbyId].serverFlag !== 6;
//     })
//     .reduce((res: { [lobbyId: string]: Lobby }, lobbyId) => {
//       res[lobbyId] = lobbies[lobbyId];
//       return res;
//     }, {});
// }

function calculateShowTime(lobby: Lobby) {
  const numRounds = lobby.numRounds;
  const roundNum = lobby.roundCount;

  // start with 100% of time, end with % of time
  const ratioThrough = roundNum / numRounds;
  const percentage =
    (-1.25 * (ratioThrough - 0.4)) ** 3 -
    0.2 * (3 * ratioThrough - 0.4) +
    0.795;

  // round to nearest 100ms
  return Math.ceil((FIND_TIME * percentage) / 100) * 100;
}

function timeAbsDiff(time1: number, time2: number) {
  return Math.abs(time1 - time2);
}

module.exports = router;
