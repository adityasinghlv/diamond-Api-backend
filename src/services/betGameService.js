const { logger } = require('../utils/logger');
const { gameModel, gameSeriesModel,userMatchExposureModel, betMatchModel, userBetModel, userModel, bookmakersModel, matchFancyModel, transactionModel, commissionReportModel,userGameStatusModel } = require('../models');
const axios = require('axios');
const moment = require('moment');
const randomstring = require('randomstring');
const LOG_ID = 'services/betGamesService';
const constant = require('../../config/default.json');
const { query } = require('../utils/mongodbQuery');
const mongoose = require('mongoose');
const { userDao } = require('../dao');
const { getkeydata, setkeydata, deletedata } = require('../dataSource/redis');
const pLimit = require('p-limit');
const limit = pLimit(100);





exports.games = async () => {
    try {
        const getGames = await gameModel.find({ status: "active" }).lean();

        if (getGames.length > 0) {
            return {
                success: true,
                message: 'Retrieved active games successfully.',
                data: getGames
            };
        }


        return {
            success: true,
            message: 'No active games found.',
            data: []
        };

    } catch (error) {

        logger.error(LOG_ID, `Error retrieving games: ${error.message}`, { errorStack: error.stack });
        if (error.name === 'MongoNetworkError') {
            return {
                success: false,
                message: 'Database connection issue.'
            };
        }

        return {
            success: false,
            message: 'Something went wrong.'
        };
    }
};



exports.gameSeries = async (reqBody) => {
    try {
        const { gameId } = reqBody;
        const getGameSeries = await gameSeriesModel.aggregate([
            {
                $match: { gameId }
            },
            {
                $lookup: {
                    from: 'betmatches',
                    localField: 'id',
                    foreignField: 'series_id',
                    pipeline: [
                        {
                            $match: { status: 'active' }
                        },
                        {
                            $project: {
                                _id: 1,
                                eventId: 1,
                                eventName: { $ifNull: ["$event.name", ""] }
                            }
                        }
                    ],
                    as: 'Matches'
                }
            },
            {
                $addFields: {
                    matchCount: { $size: "$Matches" }
                }
            },
            {
                $match: {
                    matchCount: { $gt: 0 }
                }
            }
        ]);

        if (getGameSeries.length > 0) {
            return {
                success: true,
                message: 'Game series fetched successfully.',
                data: getGameSeries
            };
        }

        return {
            success: false,
            message: 'Game series not found.',
            data: []
        };
    } catch (error) {
        logger.error(LOG_ID, `Error retrieving game series: ${error}`);
        return {
            success: false,
            message: 'Something went wrong.'
        };
    }
};
exports.place = async (reqBody, auth) => {
    try {
        const { marketId, stake, matchId, selectionId, type, betType, odds } = reqBody;
        const placeTime=new Date();
        if (!stake) {
            return {
                success: false,
                message: 'Stack must be greater than 0'
            };
        }
        if (!matchId || !selectionId || isNaN(stake)) {
            return {
                success: false,
                message: 'Bad request'
            };
        }
        const loginUser = await userModel.findById(auth._id);
        console.log("---------loginUser--",loginUser)
        if ( loginUser.status === 'locked') {
            return {
                success: false,
                message: 'Your bet has been locked. Please contact your upline  !'
            };
        }

        if ( loginUser.status === 'suspended') {
            return {
                success: false,
                message: 'You have been suspended. Please contact your upline  !'
            };
        }


        let amountInINR = parseInt(stake);
        const userId = auth._id;
        // if (loginUser.exposureLimit < (loginUser.exposer + amountInINR)){
        //     return {
        //         success: false,
        //         message: `Out Of Exposure Limit`
        //     };
        // }
        const match = await betMatchModel.findOne({ _id: matchId }).lean();
        console.log("_____",match)
        const oddsDelay=type=='odds'?match?.oddsDelay||0:type=='toss'?match?.tossDelay||0:type=='bookmakers'?match?.bookDelay||0:type=='fancy'?match?.sessionDelay||0:0;
        if (type=='odds' && match.series_name !== "Test Matches" && odds > 100) {
          return {
            success: false,
            message: "Bet not Accept over Rate 100 .",
          };
        }
        if (type =='odds' && match?.series_name === "Test Matches" && odds > 10) {
          return {
            success: false,
            message: "Bet not Accept over Rate 10 for Test Matches.",
          };
        }
      
    //    const gameStatus = await userGameStatusModel.findOne({ userId: auth._id , gameId: match.sportsId});
    //     if (gameStatus?.active === false || !gameStatus ) {
    //         return {
    //             success: false,
    //             message: 'Your bet has been locked. Please contact your upline !'
    //         };
    //     }
    
        if(type === 'toss'){
            // "2025-02-18 14:00:00"
            if (new Date() >= new Date(new Date(match.marketStartTime).setHours(new Date(match.marketStartTime).getHours() - 1))) {
                return {
                    success: false,
                    message: "Betting is closed."
                };
            }
        }

        if (type === 'odds') {
            if (amountInINR < match.oddsMinStake) {
                return {
                    success: false,
                    message: `Minimum bet limit is ${match.oddsMinStake}`
                };
            }
            if (amountInINR > match.oddsMaxStake) {
                return {
                    success: false,
                    message: `Maximum bet limit is ${match.oddsMaxStake}`
                };
            }
        }
        
        if (type === 'bookmakers') {
            if (amountInINR < match.bookMinStake) {
                return {
                    success: false,
                    message: `Minimum bet limit is ${match.bookMinStake}`
                };
            }
            if (amountInINR > match.bookMaxStake) {
                return {
                    success: false,
                    message: `Maximum bet limit is ${match.bookMaxStake}`
                };
            }
        }
        
        if (type === 'fancy') {
            if (amountInINR < match.sessionMinStake) {
                return {
                    success: false,
                    message: `Minimum bet limit is ${match.sessionMinStake}`
                };
            }
            if (amountInINR > match.sessionMaxStake) {
                return {
                    success: false,
                    message: `Maximum bet limit is ${match.sessionMaxStake}`
                };
            }
        }

        if (type === 'toss') {
            if (amountInINR < match.tossMinStake) {
                return {
                    success: false,
                    message: `Minimum bet limit is ${match.tossMinStake}`
                };
            }
            if (amountInINR > match.tossMaxStake) {
                return {
                    success: false,
                    message: `Maximum bet limit is ${match.tossMaxStake}`
                };
            }
        }

        

        const user = await userModel.findOne({ _id: userId });
        if (!user) {
            return {
                success: false,
                message: 'Player not found'
            };
        }

        let balance = (user?.totalBalance || 0) - (user?.exposer || 0);
        let balanceWithoutExpo=user?.totalBalance||0; 

        balance = parseFloat(balance.toFixed(2));

       

        // if (balance < amountInINR) {
        //     return {
        //         success: false,
        //         message: 'You have insufficient balance'
        //     };
        // }

        reqBody.balance=balance;
        reqBody.balanceWithoutExpo=balanceWithoutExpo;
        reqBody.exposureLimit=loginUser?.exposureLimit||0;
        let getOdds = { success: false };
        if (type === 'odds') getOdds = await checkOdds(match, {...reqBody,userId});
        if (type === 'toss') getOdds = await checkTossOdds(match, {...reqBody,userId});
        if (type === 'bookmakers') getOdds = await checkBookmaker(match, {...reqBody,userId});
        if (type === 'fancy') getOdds = await checkFancy(match, {...reqBody,userId});

        if (!getOdds.success) return getOdds;
        const {id,originalOdds,updatedExposure}=getOdds;
        const betId = randomstring.generate(8);
        const obj = await userTransaction(
            originalOdds,
            placeTime,
            marketId,
            userId,
            betId,
            matchId,
            selectionId,
            balance,
            id,
            type,
            betType,
            getOdds,
            reqBody,
            user?.profitLossBalance || 0,
            oddsDelay
        );

        if (!obj.success) {
            return {
                success: false,
                message: 'Bad request'
            };
        }

        return {
            success: true,
            message: 'Bet placed successfully'
        };

    } catch (error) {
        console.log('Error making bet:In catch block (success: false)', error);
        return {
            success: false,
            message: 'Bad request'
        };
    }
};



const checkTossOdds = async (match, reqBody) => {
    const betOddsData = match?.tossMarket || [];

    if (!betOddsData?.length) {
        return { success: false, message: "Odds are not available" };
    }

    const getOdds = betOddsData.find(ele => ele.selectionId == reqBody.selectionId);

    if (getOdds?.status !== "ACTIVE") {
        return { success: false, message: "This bet status is closed" };
    }

    const potentialWin = (reqBody.stake * getOdds.odds) - reqBody.stake;
    const liability = reqBody.stake;

        let id=`${Date.now()}`
        
        const checkExposureData = await checkExposure({
            userId: reqBody.userId,
            matchId: reqBody.matchId,
            id,
            type: reqBody.marketType || "toss", 
            runnerId: reqBody.selectionId,
            betType: reqBody.betType,
            stake: reqBody.stake,
            odds: reqBody.odds,
            
        });

        if (reqBody.exposureLimit < checkExposureData?.exposure||0){
            return {
                success: false,
                message: `Out Of Exposure Limit`
            };
        }

        if ((reqBody?.balanceWithoutExpo)<(checkExposureData?.exposure||0)){
            return {
                success: false,
                message: `Insufficent balance.`
            };
        }



        const updatedExposure = await adjustExposure({
            userId: reqBody.userId,
            matchId: reqBody.matchId,
            id,
            type: reqBody.marketType || "toss", 
            runnerId: reqBody.selectionId,
            betType: reqBody.betType,
            stake: reqBody.stake,
            odds: reqBody.odds
        });

     

        return {
            success: true,
            potentialWin,
            amount: liability,
            id,
            odds: reqBody.odds,
            fancyOdds: "0",
            updatedExposure 
        };

    // return { success: false };
};

const checkOdds = async (match, reqBody) => {
    const betOddsData = match?.market || [];

    if (!betOddsData?.length) {
        return { success: false, message: "Odds are not available" };
    }

    const getOdds = betOddsData.find(ele => ele.selectionId == reqBody.selectionId);

    if (getOdds?.status !== "ACTIVE") {
        return { success: false, message: "This bet status is closed" };
    }

    if (getOdds?.ex) {
        const { ex } = getOdds;
        const betType = reqBody.betType === "back" ? "availableToBack" : "availableToLay";

        let checkOddsPrice;
        if (reqBody.betType === "back") {
            checkOddsPrice = ex[betType].filter(ele => ele.price == reqBody.odds);
        } else if (reqBody.betType === "lay") {
            checkOddsPrice = ex[betType].filter(ele => ele.price == reqBody.odds);
        }


        if (checkOddsPrice.length === 0) {
            return { success: false, message: "Odds changed" };
        }

 
        const oddsDetails = checkOddsPrice[0];
        const potentialWin = reqBody.betType === "back"
            ? (reqBody.stake * reqBody.odds) - reqBody.stake
            : reqBody.stake;

        const liability = reqBody.betType === "back"
            ? reqBody.stake
            : reqBody.stake * (reqBody.odds - 1);

        // if (reqBody.balance < liability){
        //     return {
        //         success: false,
        //         message: `Insufficent balance.`
        //     };
        // }

        const id=`${Date.now()}`

        const checkExposureData = await checkExposure({
            userId: reqBody.userId,
            matchId: reqBody.matchId,
            id,
            type: reqBody.marketType || "odds", 
            runnerId: reqBody.selectionId,
            betType: reqBody.betType,
            stake: reqBody.stake,
            odds: reqBody.odds,
            
        });

        if (reqBody.exposureLimit < checkExposureData?.exposure||0){
            return {
                success: false,
                message: `Out Of Exposure Limit`
            };
        }

        if ((reqBody?.balanceWithoutExpo)<(checkExposureData?.exposure||0)){
            return {
                success: false,
                message: `Insufficent balance.`
            };
        }



        const updatedExposure = await adjustExposure({
            userId: reqBody.userId,
            matchId: reqBody.matchId,
            id,
            type: reqBody.marketType || "odds", 
            runnerId: reqBody.selectionId,
            betType: reqBody.betType,
            stake: reqBody.stake,
            odds: reqBody.odds,
            
        });

        return {
            success: true,
            potentialWin,
            amount: liability,
            id,
            odds: reqBody.odds,
            fancyOdds: "0",
            updatedExposure,
            originalOdds:checkOddsPrice
        };
    }

    return { success: false };
};

const checkExposure = async (betDetails) => {
    const { userId, matchId, type, runnerId, betType, stake,id, odds, fancyOdds } = betDetails;

    const potentialProfit = betType === "back" ? (odds - 1) * stake : -((odds - 1) * stake);
    const liability = betType === "back" ? -stake : stake;


    let exposure = {};
    if(type=='odds'||type=='bookmakers'||type=='toss'){
        exposure=await userMatchExposureModel.findOne({ userId, matchId, type });
    }else{
        exposure=await userMatchExposureModel.findOne({ userId, matchId, type,'bets.runnerId':runnerId });
    }
    
    let previousMarketExposure = exposure ? exposure.marketExposure : 0;

    if (!exposure) {
        exposure = new userMatchExposureModel({
            userId,
            matchId,
            type,
            bets: [],
            netExposure: {}, 
            marketExposure: 0
        });
    }

    const bet = {
        runnerId,
        betType,
        stake,
        odds,
        id,
        potentialProfit,
        liability,
        fancyOdds
    };

    exposure.bets.push(bet);
    const bets=exposure.bets;
    const netExposure={};
    bets.forEach(bet => {
        if(bet.status==1){
            const { runnerId, potentialProfit, liability } = bet;

        if (!netExposure[runnerId]) netExposure[runnerId] = 0;
        netExposure[runnerId] += potentialProfit;
        const oppositeRunnerId=bets.find(e=>e.runnerId!=runnerId)?.runnerId||'tempOppRunnerId';

        if(oppositeRunnerId!=='tempOppRunnerId'&&netExposure['tempOppRunnerId']){
            netExposure[oppositeRunnerId] = 0;
            netExposure[oppositeRunnerId] += liability+netExposure['tempOppRunnerId'];
            delete netExposure.tempOppRunnerId;

        }else{
            if (!netExposure[oppositeRunnerId]) netExposure[oppositeRunnerId] = 0;
            netExposure[oppositeRunnerId] += liability;
        }
     }
    });

    exposure.marketExposure = Math.min(...Object.values(netExposure))>0?0:Math.min(...Object.values(netExposure));
    // await exposure.save();

    const updatedExposure=await userModel.findOne({_id:userId}).lean();
    exposure.exposure= updatedExposure.exposer-Math.abs(previousMarketExposure) + Math.abs(exposure.marketExposure);
    return exposure;
};


const adjustExposure = async (betDetails) => {
    const { userId, matchId, type, runnerId, betType, stake,id, odds, fancyOdds } = betDetails;

    const potentialProfit = betType === "back" ? (odds - 1) * stake : -((odds - 1) * stake);
    const liability = betType === "back" ? -stake : stake;


    let exposure = {};
    if(type=='odds'||type=='bookmakers'||type=='toss'){
        exposure=await userMatchExposureModel.findOne({ userId, matchId, type });
    }else{
        exposure=await userMatchExposureModel.findOne({ userId, matchId, type,'bets.runnerId':runnerId });
    }
    
    let previousMarketExposure = exposure ? exposure.marketExposure : 0;

    if (!exposure) {
        exposure = new userMatchExposureModel({
            userId,
            matchId,
            type,
            bets: [],
            netExposure: {}, 
            marketExposure: 0
        });
    }

    const bet = {
        runnerId,
        betType,
        stake,
        odds,
        id,
        potentialProfit,
        liability,
        fancyOdds
    };

    exposure.bets.push(bet);
    const bets=exposure.bets;
    const netExposure={};
    bets.forEach(bet => {
        if(bet.status==1){
        const { runnerId, potentialProfit, liability } = bet;

        if (!netExposure[runnerId]) netExposure[runnerId] = 0;
        netExposure[runnerId] += potentialProfit;
        const oppositeRunnerId=bets.find(e=>e.runnerId!=runnerId)?.runnerId||'tempOppRunnerId';

        if(oppositeRunnerId!=='tempOppRunnerId'&&netExposure['tempOppRunnerId']){
            netExposure[oppositeRunnerId] = 0;
            netExposure[oppositeRunnerId] += liability+netExposure['tempOppRunnerId'];
            delete netExposure.tempOppRunnerId;

        }else{
            if (!netExposure[oppositeRunnerId]) netExposure[oppositeRunnerId] = 0;
            netExposure[oppositeRunnerId] += liability;
        }
      }
        

    });

    exposure.marketExposure = Math.min(...Object.values(netExposure))>0?0:Math.min(...Object.values(netExposure));
    await exposure.save();

    const updatedExposure=await userModel.findByIdAndUpdate(userId, {
        $inc: { exposer: -Math.abs(previousMarketExposure) + Math.abs(exposure.marketExposure) }
    },{ new: true });

    exposure.exposure =updatedExposure.exposer;

    return exposure;
};


const adjustFancyExposure = async (betDetails) => {
    const { userId, matchId, type, runnerId, betType, stake, odds, fancyOdds ,id} = betDetails;

    const potentialProfit = betType === "back" ? (odds - 1) * stake :  stake;
    const liability = betType === "back" ? stake : (odds - 1) * stake;


    let  exposure=await userMatchExposureModel.findOne({ userId, matchId, type,'bets.runnerId':runnerId });
    
    let previousMarketExposure = exposure ? exposure.marketExposure : 0;
    if (!exposure) {
        exposure = new userMatchExposureModel({
            userId,
            matchId,
            type,
            id,
            bets: [],
            netExposure: {}, 
            marketExposure: 0
        });
    }

    const bet = {
        runnerId,
        betType,
        stake,
        odds,
        id,
        potentialProfit,
        liability,
        fancyOdds
    };

    exposure.bets.push(bet);
    const bets=exposure.bets;

    function calculateNetExposure(bets) {
        let matchRunsArray = [...new Set(bets.flatMap(bet => [Number(bet.fancyOdds) - 1, Number(bet.fancyOdds), Number(bet.fancyOdds) + 1]))];
        matchRunsArray.sort((a, b) => a - b);
      
        let worstCaseLoss = 0; 
      
        for (let matchRuns of matchRunsArray) {
            let totalProfit = 0;
            let totalLoss = 0;
      
            bets.forEach(bet => {
                const { betType, fancyOdds,liability, potentialProfit } = bet;
      
                if (betType === "lay") {
                    if (matchRuns < Number(fancyOdds)) {
                        totalProfit += potentialProfit; 
                    } else {
                        totalLoss += liability; 
                    }
                } else if (betType === "back") {
                    if (matchRuns >= Number(fancyOdds)) {
                        totalProfit += potentialProfit; 
                    } else {
                        totalLoss += liability; 
                    }
                }
            });
      
            let netProfitLoss = totalProfit - totalLoss;
            worstCaseLoss = Math.min(worstCaseLoss, netProfitLoss); 
        }
      
        return Math.abs(worstCaseLoss); 
      }

   
    const netExposure={};
    let netExposureAmount=0;
    if(bets.length==1){
        netExposureAmount=bets[0].liability
    }else{
        netExposureAmount=calculateNetExposure(bets);
    }
    
    exposure.marketExposure = netExposureAmount;
    await exposure.save();

    const updatedUser=await userModel.findByIdAndUpdate(userId, {
        $inc: { exposer: -Math.abs(previousMarketExposure) + Math.abs(exposure.marketExposure) }
    });

    exposure.exposure=updatedUser.exposer;
    return exposure;
};

const checkFancyExposure = async (betDetails) => {
    const { userId, matchId, type, runnerId, betType, stake, odds, fancyOdds ,id} = betDetails;

    const potentialProfit = betType === "back" ? (odds - 1) * stake :  stake;
    const liability = betType === "back" ? stake : (odds - 1) * stake;


    let  exposure=await userMatchExposureModel.findOne({ userId, matchId, type,'bets.runnerId':runnerId });
    
    let previousMarketExposure = exposure ? exposure.marketExposure : 0;
    if (!exposure) {
        exposure = new userMatchExposureModel({
            userId,
            matchId,
            type,
            id,
            bets: [],
            netExposure: {}, 
            marketExposure: 0
        });
    }

    const bet = {
        runnerId,
        betType,
        stake,
        odds,
        id,
        potentialProfit,
        liability,
        fancyOdds
    };

    exposure.bets.push(bet);
    const bets=exposure.bets;

    function calculateNetExposure(bets) {
        let matchRunsArray = [...new Set(bets.flatMap(bet => [Number(bet.fancyOdds) - 1, Number(bet.fancyOdds), Number(bet.fancyOdds) + 1]))];
        matchRunsArray.sort((a, b) => a - b);
      
        let worstCaseLoss = 0; 
      
        for (let matchRuns of matchRunsArray) {
            let totalProfit = 0;
            let totalLoss = 0;
      
            bets.forEach(bet => {
                if(bet.status==1){
                const { betType, fancyOdds,liability, potentialProfit } = bet;
      
                if (betType === "lay") {
                    if (matchRuns < Number(fancyOdds)) {
                        totalProfit += potentialProfit; 
                    } else {
                        totalLoss += liability; 
                    }
                } else if (betType === "back") {
                    if (matchRuns >= Number(fancyOdds)) {
                        totalProfit += potentialProfit; 
                    } else {
                        totalLoss += liability; 
                    }
                }
             }
            });
      
            let netProfitLoss = totalProfit - totalLoss;
            worstCaseLoss = Math.min(worstCaseLoss, netProfitLoss); 
        }
      
        return Math.abs(worstCaseLoss); 
      }

   
    const netExposure={};
    let netExposureAmount=0;
    if(bets.length==1){
        netExposureAmount=bets[0].liability
    }else{
        netExposureAmount=calculateNetExposure(bets);
    }
    
    exposure.marketExposure = netExposureAmount;

    const updatedExposure=await userModel.findOne({_id:userId}).lean();
    updatedExposure.exposer= updatedExposure?.exposer-Math.abs(previousMarketExposure||0) + Math.abs(exposure?.marketExposure||0);
    exposure.exposure=updatedExposure.exposer;
    return exposure;
};





const checkBookmaker = async (match, reqBody) => {
    try {

        const betOddsData = await bookmakersModel.findOne({ matchId: match._id }).lean();
        if (!betOddsData) {
            return {
                success: false,
                message: 'Odds are not available.'
            };
        }


        const getRunners = betOddsData.bookmakers.find((ele) => ele.selectionId == reqBody.selectionId);
        console.log("=============================>>>",getRunners)

        if (getRunners?.statusName !== 'ONLINE'&&getRunners?.statusName !== 'ACTIVE') {
            return {
                success: false,
                message: 'This bet status is not active.'
            };
        }

        const oddsType = reqBody.betType === 'back' ? 'backOdds' : 'layOdds';
        const oddsData = getRunners[oddsType];
        
        if (!oddsData||oddsData!=reqBody.odds) {
            return {
                success: false,
                message: 'Odds have changed.'
            };
        }

        const potentialWin = reqBody.betType === 'back'
            ? (oddsData * reqBody.stake) / 100
            : reqBody.stake;
        const liability = reqBody.betType === 'back'
            ? reqBody.stake
            : (oddsData * reqBody.stake) / 100;

            const id=`${Date.now()}`

            // if (reqBody.balance < liability){
            //     return {
            //         success: false,
            //         message: `Insufficent balance.`
            //     };
            // }
            

            const checkExposureData = await checkExposure({
                userId: reqBody.userId,
                matchId: reqBody.matchId,
                id,
                type: reqBody.marketType || "bookmakers", 
                runnerId: reqBody.selectionId,
                betType: reqBody.betType,
                stake: reqBody.stake,
                odds: (oddsData/100)+1
            });

            if (reqBody.exposureLimit < checkExposureData?.exposure||0){
                return {
                    success: false,
                    message: `Out Of Exposure Limit`
                };
            }
    
            if ((reqBody?.balanceWithoutExpo)<(checkExposureData?.exposure||0)){
                return {
                    success: false,
                    message: `Insufficent balance.`
                };
            }
    
            const updatedExposure = await adjustExposure({
                userId: reqBody.userId,
                matchId: reqBody.matchId,
                id,
                type: reqBody.marketType || "bookmakers", 
                runnerId: reqBody.selectionId,
                betType: reqBody.betType,
                stake: reqBody.stake,
                odds: (oddsData/100)+1
            });

            
        return {
            success: true,
            potentialWin,
            id,
            amount: liability,
            odds: oddsData,
            fancyOdds: '0',
        };
    } catch (error) {
        console.error('Error in checkBookmaker:', error);
        return {
            success: false,
            message: 'An error occurred while processing bet.'
        };
    }
};


const checkFancy = async (match, reqBody) => {
    try {

        const betOddsData = await matchFancyModel.findOne({ matchId: match._id }).lean();
        if (!betOddsData) {
            return {
                success: false,
                message: 'Odds are not available'
            };
        }

        const getOdds = betOddsData.Fancy.find((ele) => ele.marketId == reqBody.selectionId);
        if (!getOdds) {
            return {
                success: false,
                message: 'Selection not found'
            };
        }

        // if (getOdds.statusName != 'ACTIVE') {
        //     return {
        //         success: false,
        //         message: 'This bet status is not active.'
        //     };
        // }


        let adjustedOdds=1;
        if (reqBody.betType === 'yes') {
            let backSize1 = getOdds.oddsYes;
            console.log("=============================>>>",reqBody.run,getOdds.runsYes)
            if (reqBody.run != getOdds.runsYes) {
                return {
                    success: false,
                    message: 'Odds changed'
                };
            }

            let potentialWin = (reqBody.stake * backSize1) / 100;
            let Liability = reqBody.stake;
            adjustedOdds=(backSize1/100)+1;
            const id=`${Date.now()}`

            const checkExposureData = await checkFancyExposure({
                userId: reqBody.userId,
                matchId: reqBody.matchId,
                type: reqBody.marketType || "fancy", 
                runnerId: reqBody.selectionId,
                betType: reqBody.betType=='yes'?'back':'lay',
                stake: reqBody.stake,
                id,
                odds: adjustedOdds,
                fancyOdds: getOdds.runsYes
            });



            if (reqBody.exposureLimit < checkExposureData?.exposure||0){
                return {
                    success: false,
                    message: `Out Of Exposure Limit`
                };
            }
    
            if ((reqBody?.balanceWithoutExpo)<(checkExposureData?.exposure||0)){
                return {
                    success: false,
                    message: `Insufficent balance.`
                };
            }

            

            const updatedExposure = await adjustFancyExposure({
                userId: reqBody.userId,
                matchId: reqBody.matchId,
                type: reqBody.marketType || "fancy", 
                runnerId: reqBody.selectionId,
                betType: reqBody.betType=='yes'?'back':'lay',
                stake: reqBody.stake,
                id,
                odds: adjustedOdds,
                fancyOdds: getOdds.runsYes
            });

            

            return {
                success: true,
                potentialWin,
                amount: Liability,
                id,
                odds: reqBody.odds,
                fancyOdds: getOdds.runsYes,
            };
        } else if (reqBody.betType === 'no') {
            let laySize1 = getOdds.oddsNo;
            if (reqBody.run != getOdds.runsNo) {
                return {
                    success: false,
                    message: 'Odds changed'
                };
            }

            let potentialWin = reqBody.stake;
            let Liability = (reqBody.stake * laySize1) / 100;

            

            adjustedOdds=(laySize1/100)+1;
            const id=`${Date.now()}`


            const checkExposureData = await checkFancyExposure({
                userId: reqBody.userId,
                matchId: reqBody.matchId,
                type: reqBody.marketType || "fancy", 
                runnerId: reqBody.selectionId,
                betType: reqBody.betType=='yes'?'back':'lay',
                stake: reqBody.stake,
                id,
                odds: adjustedOdds,
                fancyOdds: getOdds.runsNo,
            });

            if (reqBody.exposureLimit < checkExposureData?.exposure||0){
                return {
                    success: false,
                    message: `Out Of Exposure Limit`
                };
            }
    
            if ((reqBody?.balanceWithoutExpo)<(checkExposureData?.exposure||0)){
                return {
                    success: false,
                    message: `Insufficent balance.`
                };
            }


            const updatedExposure = await adjustFancyExposure({
                userId: reqBody.userId,
                matchId: reqBody.matchId,
                type: reqBody.marketType || "fancy", 
                runnerId: reqBody.selectionId,
                betType: reqBody.betType=='yes'?'back':'lay',
                stake: reqBody.stake,
                id,
                odds: adjustedOdds,
                fancyOdds: getOdds.runsNo,
            });

            // if (reqBody.balanceWithoutExpo < updatedExposure.exposure){
            //     return {
            //         success: false,
            //         message: `Insufficent balance.`
            //     };
            // }

            return {
                success: true,
                potentialWin,
                amount: Liability,
                id,
                odds: reqBody.odds,
                fancyOdds: getOdds.runsNo,
            };
        }

        return { success: false, message: 'Invalid bet type' };
    } catch (error) {
        console.error('Error in checkFancy:', error);
        return {
            success: false,
            message: 'An error occurred while checking fancy'
        };
    }
};

const userTransaction = async (originalOdds,placeTime,marketId, userId,betId,  matchId, selectionId, balance,id, type, betType, getOdds, reqBody, profitLossPoints = 0, oddsDelay = 0) => {
    try {

        const generateTransactionId = () => {
            const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4 });
            return `${constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
        };

        const tranid = generateTransactionId();


        const userBetObj = {
            originalOdds:originalOdds||[],
            userId,
            marketId,
            betId,
            id,
            matchId,
            potentialWin: getOdds.potentialWin,
            transaction_id: tranid,
            status: 'open',
            amount: getOdds.amount,
            odds: getOdds.odds,
            fancyOdds: getOdds.fancyOdds,
            selectionId,
            type,
            betType,
            placeTime,
            matchTime:new Date(new Date().getTime() + oddsDelay * 1000),
            marketName: reqBody.marketName,
            // marketType: reqBody.marketType,
        };

        console.log({
            userId,
            marketId,
            matchId,
            potentialWin: getOdds.potentialWin,
            transactionId: tranid,
            status: 'open',
            amount: getOdds.amount,
            odds: getOdds.odds,
            fancyOdds: getOdds.fancyOdds,
            selectionId,
            type,
            id,
            betType,
            marketName: reqBody.marketName,
            // marketType: reqBody.marketType,
        });

        const bet = await userBetModel.create(userBetObj);
        const transactiondata = {
            userId,
            transactionType: 'debit',
            amount: Number(getOdds.amount),
            currentMainWallet: Number(balance) + Number(profitLossPoints) - Number(getOdds.amount),
            description: 'Bet Joining Fee',
            previousMainWallet: Number(balance) + Number(profitLossPoints),
            transactionId: tranid,
            status: 'pending',
            type : 'betplace',
            betId:bet._id,
            matchId:matchId
        };


        const userUpdateQuery = { $inc: { exposer: 0 } };
        const getUser = await userModel.findOneAndUpdate({ _id: userId }, userUpdateQuery, { new: true });

        
        await transactionModel.create(transactiondata);


        return getUser
            ? { success: 200, message: 'Successfully placed bet' }
            : { success: false, message: 'Not enough money' };

    } catch (error) {
        console.error('Error making bet:', error);
        return { success: false, message: `Error: ${error.message}` };
    }
};



exports.betHistory = async (req) => {
    try {

        let { page = 1, perPage = 10, status, matchId,betstatus,game_id, startDate,selectionId, type, endDate, sportsId } = req.query;
        page = Number(page) || 1;
        perPage = Number(perPage) || 10;
        let aggPipe = [];

        aggPipe.push({
            $match: {
                userId: new mongoose.Types.ObjectId(req.auth._id)
            }
        });

        if(game_id){
            aggPipe.push({
                $match: {
                    game_id: parseInt(game_id)
                }
            });
        }

        if(matchId){
            aggPipe.push({
                $match: {
                    matchId: new mongoose.Types.ObjectId(matchId)
                }
            });
        }

        if(selectionId){
            aggPipe.push({
                $match: {
                    selectionId: selectionId
                }
            });
        }

       
        if(type){
            aggPipe.push({
                $match: {
                    type
                }
            });
        }
        

        if(betstatus){
            if(betstatus=='deleted'){
                aggPipe.push({
                    $match: {
                        isDeleted:true
                    }
                });
            }else if(betstatus=='unsettled'){
                aggPipe.push({
                    $match: {
                        betstatus,
                        isDeleted:false
                    }
                });
            }else if(betstatus=='settled'){
                aggPipe.push({
                    $match: {
                        betstatus,
                        isDeleted:false
                    }
                });
            }
            
        }

        console.log(aggPipe)

        // aggPipe.push(
        //     {
        //         $lookup: {
        //             from: 'betmatches',
        //             localField: 'matchId',
        //             foreignField: '_id',
        //             pipeline: [
        //                 {
        //                     $project: {
        //                         eventId: 1,
        //                         bookMakerStatus: 1,
        //                         match: 1,
        //                         stopBet: 1,
        //                         status: 1,
        //                         scoreUrl: 1,
        //                         oddsStatus: 1,
        //                         inPlay: 1,
        //                         sport: 1,
        //                         marketStartTime:1,
        //                         sportsId:1,
        //                         market:1,
        //                         bookmakers:1,

        //                     }
        //                 }
        //             ],
        //             as: 'matchdetails'
        //         }
        //     },
        //     {
        //         $unwind: {
        //             path: '$matchdetails',
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },
        //     {
        //         $sort: {
        //             'createdAt': -1
        //         }
        //     },
        //     {
        //         $addFields:{ 
        //             sportsId: { $ifNull: ["$matchdetails.sportsId", 1]},
        //             commission:{ $ifNull: ["$commission",0]}
        //         }
        //     }
        //   );

          aggPipe.push(
            {
                $facet: {
                    casinoType: [
                        { $match: { type: "casino" } },
                        {
                            $lookup: {
                                from: 'casinoprovidergames',
                                localField: 'game_id',
                                foreignField: 'gameId',
                                pipeline: [],
                                as: 'GameDetails'
                            }
                        },
                        {
                            $unwind: {
                                path: '$GameDetails',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $addFields: {
                                name: { $ifNull: ["$GameDetails.name", ""] },
                                provider: { $ifNull: ["$GameDetails.provider", ""] },
                                commission: { $ifNull: ["$commission", 0] }
                            }
                        }
                    ],
                    otherType: [
                        { $match: { type: { $ne: "casino" } } }, 
                        {
                            $lookup: {
                                from: 'betmatches',
                                localField: 'matchId',
                                foreignField: '_id',
                                pipeline: [
                                    {
                                        $project: {
                                            eventId: 1,
                                            bookMakerStatus: 1,
                                            match: 1,
                                            stopBet: 1,
                                            status: 1,
                                            scoreUrl: 1,
                                            oddsStatus: 1,
                                            inPlay: 1,
                                            sport: 1,
                                            marketStartTime: 1,
                                            sportsId: 1,
                                            market: 1,
                                            bookmakers: 1,
                                        }
                                    }
                                ],
                                as: 'matchdetails'
                            }
                        },
                        {
                            $unwind: {
                                path: '$matchdetails',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $sort: { 'createdAt': -1 }
                        },
                        {
                            $addFields: {
                                sportsId: { $ifNull: ["$matchdetails.sportsId", 1] },
                                commission: { $ifNull: ["$commission", 0] },
                                marketStartTime: { $ifNull: ["$matchdetails.marketStartTime", ""] }
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    data: { $concatArrays: ["$casinoType", "$otherType"] } 
                }
            },
            {
                $unwind: "$data"
            },
            {
                $replaceRoot: { newRoot: "$data" } 
            }
        );
        

        if (sportsId){
            aggPipe.push({
                $match: {
                   'sportsId': sportsId
                }
            });
        }

        if (startDate || endDate) {
            const s_Date = moment(startDate).format('YYYY-MM-DD 00:00:00');
            const e_Date = new Date(endDate);
            e_Date.setHours(23, 59, 59, 999);
            // const e_Date = moment(endDate).format('YYYY-MM-DD 23:59:59');

            const Obj = {};
            if (startDate) {
                Obj["marketStartTime"] = { $gte: s_Date };
            }

            if (endDate) {
                Obj["updatedAt"] = { $lte: e_Date };
            }

            aggPipe.push({
                $match: Obj
            });
        }


        if(status){
            const filt={
                status
            }

            if(status=='open'){
                filt.isDeleted=false;
            }
            aggPipe.push({
                $match:filt
            });
        }
         



        aggPipe.push({
            $facet: {
                'pagination': [
                    {
                        $group: {
                            _id: null,
                            totalChildrenCount: { $sum: 1 }
                        }
                    },
                    {
                        $addFields: {
                            page, perPage
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalChildrenCount: 1,
                            totalPages: {
                                $ceil: {
                                    $divide: ['$totalChildrenCount', { $ifNull: [perPage, 10] }]
                                }
                            },
                            page,
                            perPage
                        }
                    }
                ],
                'userBets': [
                    { $skip: (page - 1) * perPage },
                    { $limit: perPage }
                ]
            }
        }, {
            $unwind: '$pagination'
        }, {
            $project: {
                pagination: 1,
                userBets: 1
            }
        });

        const data = await userBetModel.aggregate(aggPipe);
        console.log(data)
        if (data.length > 0) return {
            success: true,
            message: 'Retrieved all my bets successfully.',
            data: data[0].userBets || {},
            pagination: data[0]?.pagination || {}
        };

        return {
            success: true,
            message: 'My bets not found.',
            data: [],
            pagination: {}
        };
    } catch (error) {
        logger.error(LOG_ID, `Error occurred while retrieving bets: ${error}`);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};


exports.getLiveMatches = async (req) => {
    const { gameId, type } = req.query;
    try {

        let obj = { 
            $or: [
                { match_status:0 },
                { match_status:1 }
            ]
         };
        if (gameId) {
            obj.gameId = gameId
        }

        if (type == 'INPLAY') {
            obj.inPlay = true
            obj.marketStartTime = {
                $gte: moment().startOf('day').format('YYYY-MM-DD 00:00:00')
            }
        }

        if (type == 'TODAY') {

            obj.marketStartTime = {
                $gte: moment().format('YYYY-MM-DD 00:00:00'),
                $lt: moment().format('YYYY-MM-DD 23:59:59')
            }

        }

  
        if (type == 'TOMORROW') {

            obj.marketStartTime = {
                $gte: moment().add(1, 'days').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
                $lt: moment().add(1, 'days').endOf('day').format('YYYY-MM-DD HH:mm:ss')
            }

        }

        const betMatches = await betMatchModel.aggregate([
            {
                $match: {
                    ...obj
                }
            },
            {
                $group: {
                    _id: "$sport",
                    matches: {
                        $push: {
                            _id: "$_id",
                            event: "$event",
                            eventId: "$eventId",
                            marketId: "$marketId",
                            bookmakers: "$bookmakers",
                            fancy: "$fancy",
                            oddsResult: "$oddsResult",
                            bookMakerResult: "$bookMakerResult",
                            transferredBookmakerCoin: "$transferredBookmakerCoin",
                            transferredOddsCoin: "$transferredOddsCoin",
                            bookMakerStatus: "$bookMakerStatus",
                            liveTv: "$liveTv",
                            gameId: "$gameId",
                            inPlay: "$inPlay",
                            league: "$league",
                            marketStartTime: "$marketStartTime",
                            marketType: "$marketType",
                            match: "$match",
                            scoreUrl: "$scoreUrl",
                            market: "$market",
                            status: "$status",
                            bookDelay: "$bookDelay",
                            bookMinStake: "$bookMinStake",
                            bookMaxStake: "$bookMaxStake",
                            bookMaxProfit: "$bookMaxProfit",
                            oddsDelay: "$oddsDelay",
                            oddsMaxProfit: "$oddsMaxProfit",
                            oddsMinStake: "$oddsMinStake",
                            oddsMaxStake: "$oddsMaxStake",
                            sessionDelay: "$sessionDelay",
                            sessionMaxProfit: "$sessionMaxProfit",
                            sessionMaxStake: "$sessionMaxStake",
                            sessionMinStake: "$sessionMinStake"
                        }
                    }
                }
            }
        ]);

        
        return {
            betMatches,
            success: true,
            message: 'Match fetched successfully.'
        }

    } catch (error) {
        logger.error(LOG_ID, `Error in getLiveMatchesByGameId: ${JSON.stringify(error)}`);
        console.log('Error:', error);
        throw error;
    }
};



exports.getTVUrl = async(req)=>
{ 
   try {

     const { id } = req.params;
     const betMatch = await betMatchModel.findOne({ _id :id});
     if (betMatch){
         const TV_URL = `${process.env.TV_URL}${betMatch.eventId}`;
         return {
             success: true,
             message: 'TV URL fetched successfully.',
             data: TV_URL
         };
     }
       return {
           success: false,
           message: 'Something went wrong.',
           data: ""
       };
       
   } catch (error) {

     logger.error(
        LOG_ID, 
        `Error occurred during fetching user: ${error.message || error}`
     );

     return {
        success: false,
        message: 'Something went wrong.',
        data: {}
     };

   }
}


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
        
            if(el?.ex?.availableToBack?.length==3)
                console.log("el?.ex?.availableToBack?.length==3")
                el.ex.availableToBack= el.ex.availableToBack;
            if (el?.ex?.availableToBack?.length == 2)
                console.log("el?.ex?.availableToBack?.length==2")
                el.ex.availableToBack= [...el.ex.availableToBack, dummyOdds?.[0]]
            if (el?.ex?.availableToBack?.length == 1)
                console.log("el?.ex?.availableToBack?.length==1")
                el.ex.availableToBack= [...el.ex.availableToBack, dummyOdds?.[0], dummyOdds?.[1]];
            if (el?.ex?.availableToBack?.length == 0){
                console.log("el?.ex?.availableToBack?.length==0")
                el.ex.availableToBack = [...dummyOdds];
            }
                
            else  el.ex.availableToBack= el.ex.availableToBack;
      

            if (el?.ex?.availableToLay?.length == 3)
                el.ex.availableToLay = el.ex.availableToLay;
            if (el?.ex?.availableToLay?.length == 2)
                el.ex.availableToLay = [...el.ex.availableToLay, dummyOdds?.[0]]
            if (el?.ex?.availableToLay?.length == 1)
                el.ex.availableToLay = [...el.ex.availableToLay, dummyOdds?.[0], dummyOdds?.[1]];
            if (el?.ex?.availableToLay?.length == 0)
                el.ex.availableToLay = [...dummyOdds];
            else
                el.ex.availableToLay = el.ex.availableToLay;

        return el

    });
    return data;

 }


