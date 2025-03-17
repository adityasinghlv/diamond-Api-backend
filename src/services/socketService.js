
const { betMatchModel } = require('../models');
const axios = require('axios');
const moment = require('moment');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');
const LOG_ID = 'services/socket';
const { getkeydata, setkeydata, deletedata } = require('../dataSource/redis');
const { initializeSocket, getIO } = require('../../socket');
const pLimit = require('p-limit');
const limit = pLimit(100); 

let matchDataCache = {};
let gameDataCache = {};

exports.SocketProcess = async (server) => {
    await initializeSocket(server);
    const io = getIO();
    console.log("===================================>")

    io.on('connection', async (socket) => {
        console.log(`User connected to => ${socket.id}`);

        socket.emit('connected', {
            message: 'Socket connected successfully.',
            socketId: socket.id,
            status: socket.id ? true : false
        });

        socket.on("*", (event, data) => {
            console.log(`Received event: ${event} with data:`, data);

            switch (event) {
                case 'matchList':
                    handleMatchList(socket, data);
                    break;
                case 'liveMatchList':
                    handleLiveMatchList(socket, data);
                    break;
                case 'matchDetails':
                    handleMatchDetails(socket, data);
                    break;
                case 'joinRoom':
                    handleJoinRoom(socket, data);
                    break;
                default:
                    console.log('Unhandled event:', event);
                    break;
            }
        });

        socket.on('joinGame', async (data) => {
            const { gameId } = data;
            if (gameId) {
                gameDataCache[socket.id] = gameId;
                socket.join(`game_${gameId}`);
                socket.to(`game_${gameId}`).emit('userJoinedRoom', {
                    message: `A new user has joined the room.`,
                    userId: socket.id
                });
                const update = await getLiveMatchesByGameId(gameId);
                io.to(`game_${gameId}`).emit('gameUpdate', update);
                // console.log(`User ${socket.id} joined game room: game_${gameId}`);
            }
        });

        socket.on('joinMatch', (data) => {
            const { matchId } = data;
            if (matchId) {
                matchDataCache[socket.id] = matchId;
                socket.join(`match_${matchId}`);
                socket.to(`match_${matchId}`).emit('userJoinedRoom', {
                    message: `A new user has joined the room.`,
                    userId: socket.id
                });
                console.log(`User ${socket.id} joined match room: match_${matchId}`);
            }
        });

        socket.on('disconnect', () => {
            const gameId = gameDataCache[socket.id];
            const matchId = matchDataCache[socket.id];

            if (gameId) {
                socket.leave(`game_${gameId}`);
                delete gameDataCache[socket.id];
            }

            if (matchId) {
                socket.leave(`match_${matchId}`);
                delete matchDataCache[socket.id];
            }
        });
    });

    
    setInterval(async () => {
        const activeGameIds = new Set(Object.values(gameDataCache));
        for (const gameId of activeGameIds) {
            const update = await getLiveMatchesByGameId(gameId);
            io.to(`game_${gameId}`).emit('gameUpdate', update);
        }
    }, 10000);

    setInterval(async () => {
        console.log("====================>")
        const activeMatchIds = new Set(Object.values(matchDataCache));
        for (const matchId of activeMatchIds) {
            const update = await getLiveMatchById(matchId); 
            io.to(`match_${matchId}`).emit('matchUpdate', update);
        }
    }, 400);
};

async function handleMatchList(socket, data) {
    const getMatches = await mockGetMatchesByGameId(data.gameId); 
    socket.emit(`gameId-${data.gameId}`, getMatches);
}

async function handleLiveMatchList(socket, data) {
    const getMatches = await getLiveMatchesByGameId(data.gameId);
    socket.emit(`liveMatchList-${data.gameId}`, getMatches);
}

async function handleMatchDetails(socket, data) {
    const getFancyData = await getFancyAndBookmakerData(data);
    socket.emit(`match-${getFancyData[0]?.eventId}`, getFancyData);
}

async function handleJoinRoom(socket, data) {
    const { roomId } = data;
    if (!roomId) {
        socket.emit('error', { message: 'Missing roomId.' });
        return;
    }

    socket.join(roomId);
    socket.to(roomId).emit('userJoinedRoom', {
        message: `A new user has joined the room.`,
        userId: socket.id
    });
}

const mockGetMatchesByGameId = async (gameId) => {
    const mockData = [
        {
            _id: "65f929ed761197e3511b1380",
            gameId: "1",
            eventId: "33118997",
            seriesId: "65f92613c50583b79ab9f9dd",
            event: {
                id: "33118997",
                name: "Hull City U21 v Birmingham U21",
                countryCode: "GB",
                timezone: "GMT",
                openDate: "2024-03-19T19:00:00.000Z"
            },
            status: "active",
            market: []
        },
        {
            _id: "65f929ed761197e3511b1383",
            gameId: "1",
            eventId: "33118590",
            seriesId: "65f92613c50583b79ab9f9dd",
            event: {
                id: "33118590",
                name: "Ipswich Town U21 v Bournemouth U21",
                countryCode: "GB",
                timezone: "GMT",
                openDate: "2024-03-19T13:00:00.000Z"
            },
            status: "active",
            market: []
        },
        {
            _id: "65f929ed761197e3511b1386",
            gameId: "1",
            eventId: "33118591",
            seriesId: "65f92613c50583b79ab9f9dd",
            event: {
                id: "33118591",
                name: "Watford U21 v Bristol City U21",
                countryCode: "GB",
                timezone: "GMT",
                openDate: "2024-03-19T13:00:00.000Z"
            },
            status: "completed",
            market: []
        },
        {
            _id: "65f929ed761197e3511b1386",
            gameId: "2",
            eventId: "32908080",
            seriesId: "65f92613c50583b79ab9f9dd",
            event: {
                id: "32908080",
                name: "Barrientos/Matos v Glasspool/Rojer",
                countryCode: "GB",
                timezone: "GMT",
                openDate: "2024-03-19T13:00:00.000Z"
            },
            status: "completed",
            market: []
        },
        {
            _id: "65f929ed761197e3511b1386",
            gameId: "2",
            eventId: "32908081",
            seriesId: "65f92613c50583b79ab9f9dd",
            event: {
                id: "32908081",
                name: "Purcell/Thompson v Mektic/Nys",
                countryCode: "GB",
                timezone: "GMT",
                openDate: "2024-03-19T13:00:00.000Z"
            },
            status: "completed",
            market: []
        },
        {
            _id: "65f92a2e761197e3511b13c3",
            gameId: "4",
            eventId: "33069990",
            seriesId: "65f9261cc50583b79ab9fa0b",
            event: {
                id: "33069990",
                name: "Chennai Super Kings v Royal Challengers Bangalore",
                countryCode: "GB",
                timezone: "GMT",
                openDate: "2024-03-19T13:00:00.000Z"
            },
            status: "completed",
            market: []
        },
        {
            _id: "65f9b682cfc5b78720c5aceb",
            gameId: "4",
            eventId: "28127348",
            seriesId: "65f9261cc50583b79ab9fa0b",
            event: {
                id: "28127348",
                name: "IPL 2024",
                countryCode: "IN",
                timezone: "GMT",
                openDate: "2024-03-19T13:00:00.000Z"
            },
            status: "completed",
            market: []
        }

    ];

    return mockData.filter(match => match.gameId === gameId);
};

const mockGetLiveMatchesByGameId = async (gameId) => {
    const mockData=[
        {
            "_id": "65f929ed761197e3511b1380",
            "gameId": "1",
            "eventId": "33118997",
            "seriesId": "65f92613c50583b79ab9f9dd",
            "event": {
                "id": "33118997",
                "name": "Hull City U21 v Birmingham U21",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T19:00:00.000Z"
            },
            "status": "active",
            "market": [],
            "tvurl": "",
            "sessionStatus": true,
            "inPlay": false,
            "bookMakerStatus": true
        },
        {
            "_id": "65f929ed761197e3511b1383",
            "gameId": "1",
            "eventId": "33118590",
            "seriesId": "65f92613c50583b79ab9f9dd",
            "event": {
                "id": "33118590",
                "name": "Ipswich Town U21 v Bournemouth U21",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "active",
            "market": [],
            "tvurl": "https://tv.example.com/15",
            "sessionStatus": false,
            "inPlay": true,
            "bookMakerStatus": false
        },
        {
            "_id": "65f929ed761197e3511b1386",
            "gameId": "1",
            "eventId": "33118591",
            "seriesId": "65f92613c50583b79ab9f9dd",
            "event": {
                "id": "33118591",
                "name": "Watford U21 v Bristol City U21",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "https://tv.example.com/54",
            "sessionStatus": true,
            "inPlay": false,
            "bookMakerStatus": true
        },
        {
            "_id": "65f929ed761197e3511b1386",
            "gameId": "2",
            "eventId": "32908080",
            "seriesId": "65f92613c50583b79ab9f9dd",
            "event": {
                "id": "32908080",
                "name": "Barrientos/Matos v Glasspool/Rojer",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "",
            "sessionStatus": false,
            "inPlay": true,
            "bookMakerStatus": false
        },
        {
            "_id": "65f929ed761197e3511b1386",
            "gameId": "2",
            "eventId": "32908081",
            "seriesId": "65f92613c50583b79ab9f9dd",
            "event": {
                "id": "32908081",
                "name": "Purcell/Thompson v Mektic/Nys",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "https://tv.example.com/63",
            "sessionStatus": true,
            "inPlay": false,
            "bookMakerStatus": true
        },
        {
            "_id": "65f9b6c4cfc5b78720c5adc0",
            "gameId": "2",
            "eventId": "33120834",
            "seriesId": "65f9b6bccfc5b78720c5ada1",
            "event": {
                "id": "33120834",
                "name": "V Tomova v Tama Korpatsch",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "https://tv.example.com/58",
            "sessionStatus": false,
            "inPlay": true,
            "bookMakerStatus": true
        },
        {
            "_id": "65f9b6c5cfc5b78720c5adc3",
            "gameId": "2",
            "eventId": "33120839",
            "seriesId": "65f9b6bccfc5b78720c5ada1",
            "event": {
                "id": "33120839",
                "name": "Pera v D Collins",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "https://tv.example.com/99",
            "sessionStatus": true,
            "inPlay": true,
            "bookMakerStatus": false
        },
        {
            "_id": "65f92a2e761197e3511b13c3",
            "gameId": "4",
            "eventId": "33069990",
            "seriesId": "65f9261cc50583b79ab9fa0b",
            "event": {
                "id": "33069990",
                "name": "Chennai Super Kings v Royal Challengers Bangalore",
                "countryCode": "GB",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "https://tv.example.com/33",
            "sessionStatus": false,
            "inPlay": true,
            "bookMakerStatus": false
        },
        {
            "_id": "65f9b682cfc5b78720c5aceb",
            "gameId": "4",
            "eventId": "28127348",
            "seriesId": "65f9261cc50583b79ab9fa0b",
            "event": {
                "id": "28127348",
                "name": "IPL 2024",
                "countryCode": "IN",
                "timezone": "GMT",
                "openDate": "2024-03-19T13:00:00.000Z"
            },
            "status": "completed",
            "market": [],
            "tvurl": "",
            "sessionStatus": true,
            "inPlay": false,
            "bookMakerStatus": true
        }
    ];


    return mockData.filter(match => match.gameId === gameId);
};


async function fetchGameUpdate(gameId) {
    return { gameId, timestamp: new Date(), data: `Update for game ${gameId}` };
}

async function fetchMatchUpdate(matchId) {
    return { matchId, timestamp: new Date(), data: `Update for match ${matchId}` };
}

const getLiveMatchById = async (matchId) => {
    try {
        let ob = { _id: new mongoose.Types.ObjectId(matchId), $or: [{ match_status:1},{ match_status: 0}] };
        const betMatch = await betMatchModel.aggregate([
            {
              $match: ob ,
            },
            {
                $lookup: {
                    from: "userbets",
                    localField: "_id",
                    foreignField: "matchId",
                    pipeline: [
                        {
                          $project: {
                            amount: 1,
                            type: 1,
                            betType: 1,
                            marketName:1,
                            potentialWin:1
                          }
                        },
                        {
                          $group: {
                            _id: "$type", 
                            rootDocuments: { $push: "$$ROOT" } 
                          }
                        },
                        {
                            $project: {
                              _id: 1,
                              betTypesGrouped: {
                                $map: {
                                  input: { 
                                    $setUnion: [
                                      { 
                                        $map: { 
                                          input: "$rootDocuments", 
                                          as: "doc", 
                                          in: "$$doc.marketName" 
                                        } 
                                      }
                                    ] 
                                  },
                                  as: "marketName",
                                  in: {
                                    marketName: "$$marketName", 
                                    totalAmount: {
                                        $sum: {
                                          $map: {
                                            input: {
                                              $filter: {
                                                input: "$rootDocuments", 
                                                as: "doc",
                                                cond: { $eq: ["$$doc.marketName", "$$marketName"] }
                                              }
                                            },
                                            as: "doc",
                                            in: "$$doc.amount"  
                                          }
                                        }
                                      },
                                      totalPotentialWin:{
                                        $sum: {
                                          $map: {
                                            input: {
                                              $filter: {
                                                input: "$rootDocuments", 
                                                as: "doc",
                                                cond: { $eq: ["$$doc.marketName", "$$marketName"] }
                                              }
                                            },
                                            as: "doc",
                                            in: "$$doc.potentialWin"  
                                          }
                                        }
                                      }
                                  }
                                }
                              }
                            }
                          }
                      ],
                    as: "userBets"
                }
            },
            {
                $lookup: {
                  from: "notifications",
                  localField: "_id",  
                  foreignField: "matchId",  
                  pipeline: [
                    {
                      $match: {
                        $or: [
                          { betType: "odds" },  
                          { betType: "bookmaker" },  
                          { betType: "fancy" } 
                        ]
                      }
                    },
                    {
                      $sort: { createdAt: -1 }  
                    },
                    {
                      $facet: {
                        oddsNotifications: [
                          { $match: { betType: "odds" } },
                          { $limit: 1 }  
                        ],
                        bookmakerNotifications: [
                          { $match: { betType: "bookmaker" } },
                          { $limit: 1 }  
                        ],
                        fancyNotifications: [
                          { $match: { betType: "fancy" } },
                          {
                            $group: {
                              _id: "$selectionId",  
                              latestNotification: { $first: "$$ROOT" }  
                            }
                          }
                        ]
                      }
                    },
                    {
                      $project: {
                        oddsNotification: { $arrayElemAt: ["$oddsNotifications", 0] },  
                        bookmakerNotification: { $arrayElemAt: ["$bookmakerNotifications", 0] },  
                        fancyNotifications: 1  
                      }
                    }
                  ],
                  as: "Notifications"
                }
              },
            {
                $project: {
                  event: 1,
                  eventId: 1,
                  marketId: 1,
                  oddsStatus: 1,
                  bookMakerStatus: 1,
                  sessionStatus: 1,
                  liveTv: 1,
                  gameId: 1,
                  inPlay: 1,
                  league: 1,
                  marketStartTime: 1,
                  marketType: 1,
                  match: 1,
                  scoreUrl: 1,
                  userBets: 1,
                  bookDelay: 1,
                  Notifications:1,
                  oddsDelay: 1,
                  sessionDelay: 1,
                  bookMinStake: "$bookMinStake",
                  bookMaxStake: "$bookMaxStake",
                  bookMaxProfit: "$bookMaxProfit",
                  oddsMaxProfit: "$oddsMaxProfit",
                  oddsMinStake: "$oddsMinStake",
                  oddsMaxStake: "$oddsMaxStake",
                  sessionMaxProfit: "$sessionMaxProfit",
                  sessionMaxStake: "$sessionMaxStake",
                  sessionMinStake: "$sessionMinStake",
                  oddsResult:1,
                  tossStatus:1,
                  tossDelay:1,
                  tossResult:{$ifNull: ["$tossResult", 0]},
                  marketStartDate: {
                    $dateFromString: { dateString: "$marketStartTime", format: "%Y-%m-%d %H:%M:%S" }
                  },
                  tossMarket: {
                    $cond: {
                      if: {
                        $gt: [
                          { $subtract: [
                              { $dateFromString: { dateString: "$marketStartTime", format: "%Y-%m-%d %H:%M:%S" } },
                              75 * 60 * 1000 
                          ] },
                          "$$NOW" 
                        ]
                      },
                      then: "$tossMarket",
                      else: "$$REMOVE" 
                    }
                  }
                  
                },
            }
        ]);

          
        if (betMatch.length==0) {
            return {};
        }
        const matchIdStr = betMatch[0].eventId;
        const keys = [
            `matchOdd_${matchIdStr}`,
            `bookmakers_${matchIdStr}`,
            `matchFancy_${matchIdStr}`
        ];

        await limit(() =>
            Promise.all(keys.map((key) => getkeydata(key)))
                .then(([matchOdds, bookmaker, fancy]) => {
                    betMatch[0].matchodds = (betMatch[0].oddsStatus === "active"&&betMatch[0].oddsResult ==0)?returnMatchOdds(matchOdds) || []:[];
                    betMatch[0].bookmakersOdds = betMatch[0].bookMakerStatus === "active" ? bookmaker.sort((a, b) => a.sortPeriority-b.sortPeriority) || [] : [];
                    betMatch[0].matchfancies = betMatch[0].sessionStatus === "active"?fancy.sort((a, b) => a.sortingOrder-b.sortingOrder) || []:[];
                })
                .catch((error) => {
                    logger.error(LOG_ID, `Redis error for match ${betMatch._id}: ${JSON.stringify(error)}`);
                })
        );
        // console.log(betMatch[0].tossMarket)
        return betMatch[0];
    } catch (error) {
        logger.error(LOG_ID, `Error in getLiveMatchById: ${JSON.stringify(error)}`);
        console.log('Error:', error);
        throw error;
    }
};



const getLiveMatchesByGameId = async (gameId) => {
    try {
        let ob = {
            status: 'OPEN',
            gameId: gameId,
            $or: [
                {
                    marketStartTime: {
                        $gte: moment().format('YYYY-MM-DD HH:mm:ss'),
                        $lt: moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss')
                    }
                },
                {
                    inPlay: true
                }
            ]
        };


        
        const betMatches = await betMatchModel.find(ob).select('event eventId marketId bookMakerStatus liveTv gameId inPlay league marketStartTime marketType match marketType scoreUrl'); 

        const redisPromises = betMatches.map((match) => {
            const matchIdStr = match.eventId;
            const keys = [
                `matchOdd_${matchIdStr}`,
                `bookmakers_${matchIdStr}`,
                `matchFancy_${matchIdStr}`
            ];

            return limit(() =>
                Promise.all(keys.map((key) => getkeydata(key)))
                    .then(([matchOdds, bookMaker, fancy]) => {
                        console.log(bookMaker)
                        match._doc.matchodds = returnMatchOdds(matchOdds) || [];
                        match._doc.bookmakersOdds = bookMaker || [];
                        match._doc.matchfancies = fancy || [];
                    })
                    .catch((error) => {
                        logger.error(LOG_ID, `Redis error for match ${match._id}: ${JSON.stringify(error)}`);
                    })
            );
        });

        await Promise.all(redisPromises);
        return betMatches;
    } catch (error) {
        logger.error(LOG_ID, `Error in getLiveMatchesByGameId: ${JSON.stringify(error)}`);
        console.log('Error:', error);
        throw error;
    }
};


const dummyOdds = [
    {
        price: 0,
        size: 0,
        level: 0
    },
    {
        price: 0,
        size: 0,
        level: 0
    },
    {
        price: 0,
        size: 0,
        level: 0
    }
]

returnMatchOdds = (data) => {
    if (!data) return [];
    data = data.map(el => {

        if (el?.ex?.availableToBack?.length == 3){
            el.ex.availableToBack = el.ex.availableToBack;
        }
            
       
        if (el?.ex?.availableToBack?.length == 2){
            el.ex.availableToBack = [...el.ex.availableToBack, dummyOdds?.[0]];
        }
            
        
        if (el?.ex?.availableToBack?.length == 1){
            el.ex.availableToBack = [...el.ex.availableToBack, dummyOdds?.[0], dummyOdds?.[1]];
        }
           
        if (el?.ex?.availableToBack?.length == 0) {
            el.ex.availableToBack = [...dummyOdds];
        }



        if (el?.ex?.availableToLay?.length == 3){
            el.ex.availableToLay = el.ex.availableToLay;
        }
            
        if (el?.ex?.availableToLay?.length == 2){
            el.ex.availableToLay = [...el.ex.availableToLay, dummyOdds?.[0]]
        }
            
        if (el?.ex?.availableToLay?.length == 1){
            el.ex.availableToLay = [...el.ex.availableToLay, dummyOdds?.[0], dummyOdds?.[1]];
        }
            
        if (el?.ex?.availableToLay?.length == 0){
            el.ex.availableToLay = [...dummyOdds];
        }
            

        return el

    });
    return data;

}