const { logger } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { casinoWebhookModel, casinoProviderGamesModel, transactionModel, userBetModel,userModel,spacexCasinoProviderModel } = require('../models');
const axios = require('axios');
const moment = require('moment');
const randomstring = require('randomstring');
const LOG_ID = 'services/betGamesService';
const constant = require('../../config/default.json');
const { query } = require('../utils/mongodbQuery');
const mongoose = require('mongoose');
const { userDao } = require('../dao');
const { generatePokerToken } = require('../utils/tokenGenerator');
const pLimit = require('p-limit');
const limit = pLimit(100);
const { API_URL, xArcherKey } = require('../config/dev.config');

exports.getProviders = async () => {
  try {
    const providers = await spacexCasinoProviderModel.find();
    return {
      success: true,
      message: 'Providers retrieved successfully',
      data: providers
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error in getProviders:',
      error: error.message || 'Unknown error'
    }
  }
};

exports.getProviderGames = async (id) => {
  try {

    const providerGames = await casinoProviderGamesModel.find({ providerId: id });
    return {
      success: true,
      message: 'Provider games retrieved successfully',
      data: providerGames
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error in getProviderGames:',
      error: error.message || 'Unknown error'
    }
  }
};

exports.getGameDetails = async (id,req) => {
  try {
    const gameDetails = await casinoProviderGamesModel.findOne({ _id: id });
    const url = `${API_URL}/livetable/playCasinoAuth`;
    const user=await userModel.findOne({_id:req.auth._id}).lean();

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url,
      headers: {
        xArcherKey: xArcherKey
      },
      data: {
        "username": user?.username,
        "balance": 100000,
        "casinoId": gameDetails.gameId
      }
    };
    const response = await axios.request(config);
    return {
      success: true,
      message: 'Game details retrieved successfully',
      data: response.data
    }
  } catch (error) {
    console.log('error', error);
    return {
      success: false,
      message: 'Error in getGameDetails:',
      error: error.message || 'Unknown error'
    }
  }
};




exports.casinoWebhook = async (reqBody) => {
  try {
    const data = reqBody;
    console.log('data', data);
    const casinoWebhook = await casinoWebhookModel.create({ data });
    const { username , stake, roundId,pnl, betId, status,game_id } = data;

    const generateTransactionId = () => {
      const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4 });
      return `${constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
    };

    if(username && stake && game_id && roundId && betId && status && status === 'unsettled'){
      const tranid = generateTransactionId();

      const user = await userModel.findOne({ username });
      const userId = user._id;

      console.log('username', username);
      console.log('stake', stake);

      const userBetObj = {
        userId:user._id,
        betId:data.betId,
        id:`${Date.now()}`,
        roundId:data.roundId,
        transaction_id: tranid,
        status: 'open',
        amount: stake,
        odds: 1,
        type:'casino',
        betType:'casino',
        placeTime:new Date(),
        matchTime:new Date(),
        game_id:parseInt(game_id),
        actualWinningAmount:0,
        sportsId:"3",
        marketStartTime:moment().format("YYYY-MM-DD HH:mm:ss"),
      };


      const txn = {
        userId,
        transactionType: 'debit',
        amount: stake,
        currentMainWallet: (user?.totalBalance || 0) - stake,
        description: 'Bet Joining Fee',
        previousMainWallet: (user?.totalBalance || 0),
        transactionId: tranid,
        status: 'pending',
        type : 'betplace',
        casinoBetId:betId,
        casinoRoundId: roundId,
        betType: "casino",
      };

      await transactionModel.create(txn)
      const bet = await userBetModel.create(userBetObj);

      console.log('bet', bet);
      await userModel.updateOne({ username }, { $inc: { exposer: stake } });

    }

    if(username && stake && pnl>=0 && roundId && betId && status && status === 'settled'){
      const tranid = generateTransactionId();

      const user = await userModel.findOne({ username });
      const userId = user._id;
      const userBet = await userBetModel.findOne({ betId: data.betId,roundId:data.roundId,betstatus: "unsettled"});
      // console.log('userId', userId);
      if(userBet){
        try{

        const txn = {
          userId,
          // transferedBy: req.user._id,
          transactionType: pnl > 0 ? "credit" : "debit",
          status: "confirm",
          transactionId: tranid,
          casinoBetId:betId,
          casinoRoundId: roundId,
          amount: Math.abs(pnl),
          previousMainWallet: user?.totalBalance || 0,
          currentMainWallet: (user?.totalBalance || 0) + pnl,
          description: `Transaction for bet ${betId} and round ${roundId} with result ${status}`,
          isSettlement: false,
          type: "settlement",
          betType: "casino",
        };
        
        await transactionModel.create(txn)
        
         await userModel.updateOne(
          { _id: userId },
          {
            $inc: {
              totalBalance:  pnl,
              profitLossBalance:  pnl,
              exposer: -stake,
            },
          }
        );
        
        
        await userBetModel.updateOne(
          { _id: userBet._id },
          {
            $set: {
              status: "closed",
              betstatus: "settled",
              commission:  0,
              actualWinningAmount: pnl || 0,
              result: pnl>0?"WINNER":"LOSER",
              oddsWinner:  "",
              settledTime: new Date(),
            },
          },
          { upsert: true }
        );
        }catch(error){
          console.log('error', error);
        }
      }

    }


    

    return {
      success: true,
      message: 'Game details saved successfully',
      data: {}
    }
  } catch (error) {
    console.log(error)
    console.error('Error in casinoWebhook:', error);
  }
};


