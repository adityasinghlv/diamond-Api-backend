const express = require('express');
const { validate } = require('express-validation');

const { logger } = require('../utils/logger');
const { statusCode, } = require('../../config/default.json');
const { handleResponse, handleErrorResponse } = require('../helpers/response');
const { userService } = require('../services');
const { userValidators } = require('../validators');
const { jwtVerify } = require('../middleware/auth');
const upload = require('../utils/multer');
const bannerUpload = require('../utils/bannerMulter');
const router = express.Router();
const multer = require('multer');
const LOG_ID = 'routes/user';



router.post('/login', validate(userValidators.login), async (req, res) => {
    try {
        const result = await userService.login(req.body);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.post('/createDemoUser', async (req, res) => {
    try {
        const result = await userService.createDemoUser(req, res);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.post('/register', validate(userValidators.registerUser), async (req, res) => {
    try {
        const result = await userService.registerUser(req.auth, req.body);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(
            res, 
            statusCode.BAD_REQUEST, 
            result
        );
    } catch (err) {
        logger.error(
            LOG_ID, 
            `Error occurred during registration: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.post('/changepassword', jwtVerify, validate(userValidators.changePassword), async (req, res) => {
    try {
        const result = await userService.changePassword({...req.body, _id:req.auth._id});
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID, 
            `Error occurred while fetching user profile: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.post('/savePaymentDetails', jwtVerify, upload.single('file'), async (req, res) => {
    try {
        const { flag, userId, displayName, typename } = req.body;
        
        // Check if file exists before using it
        if (req.file) {
            console.log('File uploaded:', req.file.filename); // For debugging
        } else {
            console.log('No file uploaded');
        }

        // Call the service to save payment details, passing the body and the file if available
        const result = await userService.saveUserPaymentDetails(req, {
            flag,
            userId,
            displayName,
            typename,
            file: req.file // Pass the uploaded file to the service
        });

        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred while saving payment details: ${err.message}`
        );
        handleErrorResponse(res, err.status || statusCode.INTERNAL_SERVER_ERROR, err.message, err);
    }
});


router.get('/uesrProfile',jwtVerify, async (req, res) => {
    try {
        const result = await userService.uesrProfile({userId:req.auth._id});
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});
router.get('/get-profit-loss', jwtVerify, async (req, res) => {
    try {
        
        const { page = 1, limit = 10,startDate, endDate,userId } = req.query;
        
        
        const result = await userService.getProfitLossReport(
            { page, limit, startDate, endDate,userId}, 
            req 
        );

        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID, 
            `Error occurred during fetching profit/loss report: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.post('/', async (req, res) => {
    try {
        
        const result = await userService.callBack(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID, 
            `Error occurred during fetching profit/loss report: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});




router.get('/getLogginHistory', jwtVerify, async (req, res) => {
    try {
        const { page, perPage }=req.query;
        const result = await userService.getLogginHistory({ userId: req.auth._id, page, perPage });
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred during getLogginHistory: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});



router.get('/uesrProfile',jwtVerify, async (req, res) => {
    try {
        const result = await userService.uesrProfile({userId:req.auth._id});
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getGames',jwtVerify, async (req, res) => {
    try {
        const result = await userService.getGames({userId:req.auth._id});
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});
router.get('/passwordChangeHistory',jwtVerify, async (req, res) => {
    try {
        const result = await userService.passwordChangeHistory(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during getting password change histroy: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});
router.get('/getUser',jwtVerify, async (req, res) => {
    try {
      
        const result = await userService.getUser(req);
        return handleResponse(res, statusCode.OK, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred while getting users info: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});
router.get('/getUserCommissionReport', jwtVerify, async (req, res) => {
    try {
        const result = await userService.usercommissionreport(req);

        if (result.success) {
            // Return 200 OK for successful data retrieval
            return handleResponse(res, statusCode.OK, result);
        }
        
        // Handle specific error case for no data found
        if (result.message === 'No user commission report found.') {
            return handleResponse(res, statusCode.NOT_FOUND, result);
        }
        
        // Handle other failure cases with a generic error message
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        // Log detailed error for internal tracking
        logger.error(
            LOG_ID,
            `Error occurred while getting user commission report: ${err.message}`
        );
        
        // Handle internal server errors and fallback for missing status code
        const status = err.status || statusCode.INTERNAL_SERVER_ERROR;
        return handleErrorResponse(res, status, err.message, err);
    }
});

  
router.get('/getTransactionData',jwtVerify, async (req, res) => {
    try {
      
        const result = await userService.getTransactionData(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred while getting users info: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getUser/:id',jwtVerify, async (req, res) => {
    try {
      
        const result = await userService.getUserViaID(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred while getting users info: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getGamesNoAuth', async (req, res) => {
    try {
        const result = await userService.getGamesNoAuth();
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getDemoUser', async (req, res) => {
    try {
        const result = await userService.getDemoUser();
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(LOG_ID, `Error occurred while fetching getDemoUser: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.post('/updatePaymentDetails/:id', jwtVerify, upload.single('image'), async (req, res) => {
    try {
        const result = await userService.updateUserPaymentDetails(req, req.body);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred while updating payment details: ${err.message}`
        );
        handleErrorResponse(res, err.status || statusCode.INTERNAL_SERVER_ERROR, err.message, err);
    }
});

router.post('/getUserPaymentDetails/:id', jwtVerify, async (req, res) => {
    try {
        const { flag ,page, perPage } = req.body;  // Extract flag from query params
   // Extract page and perPage for pagination

    // Validate that flag is provided
        console.log("flag is ",flag);
        if (!flag) {
            return handleResponse(res, statusCode.BAD_REQUEST, {
                success: false,
                message: 'Flag is required.',
                data: {}
            });
        }

        // Call service to get the payment details
        const result = await userService.getUserPaymentDetails(req.params.id, flag, { page, perPage });
        
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }

        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(
            LOG_ID, 
            `Error occurred while fetching payment details: ${err.message || err}`
        );
        return handleErrorResponse(res, err.status || statusCode.INTERNAL_SERVER_ERROR, err.message, err);
    }
});

router.post('/submitWithdrawRequest/:id', jwtVerify, async (req, res) => {
    try {
        const userId = req.params.id; 
        const result = await userService.submitWithdrawRequest(req,userId);
        if (result.success) {

            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error(`Error occurred while submitting withdrawal request: ${err.message}`);
        handleErrorResponse(res, err.status || statusCode.INTERNAL_SERVER_ERROR, err.message, err);
    }
});
router.post("/banner-upload", jwtVerify,bannerUpload.single("picture"), async (req, res) => {
    try {
      const result = await userService.createBanner(req); // Call the service and get the result

      if (result.success) {
        return handleResponse(res, statusCode.OK, result);
    }
    return handleResponse(
        res, 
        statusCode.BAD_REQUEST, 
        result
    );
      } catch (error) {
      console.error("Error in createPicture controller:", error);
      return { 
        success: false, 
        message:  "Internal server error" 
      };
    }
  }
  );
// Get all pictures
router.get("/get-banner",async (req, res) => {
    try {
      const result= await userService.getAllBanners(req);

      return handleResponse(res, statusCode.OK, result);
    } catch (error) {
      res.status(500).json({message:"Internal server error" });
    }
  });
// Get a single picture by ID
router.get("/get-banner/:id", jwtVerify,async (req, res) => {
    try {
      
      const result = await userService.getBannerById(req);
      return handleResponse(res, statusCode.OK, result);
    } catch (error) {
      res.status(500).json({ message:"Internal server error" });
    }
  });

router.put("/update-banner/:id", jwtVerify, bannerUpload.single("picture"), async (req, res) => {
    try {
      const result = await userService.updatePicture(req);
      return handleResponse(res, statusCode.OK, result);
    } catch (error) {
        
      res.status(500).json({ message:"Internal server error" });
    }
  });
  
  // Delete a picture
router.delete("/delete-banner/:id", jwtVerify, async (req, res) => {
    try {
      const result = await userService.deleteBanner(req);
      return handleResponse(res, statusCode.OK, result);
    } catch (error) {
      res.status(500).json({ message: "Internal server error"});
    }
  });
  

router.get('/getUserOpenBets', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserOpenBets(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching getDemoUser: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.get('/getUserRollingCommission', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserRollingCommission(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.get('/get-user-event-profit-loss', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserSportProfitLossReport(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/get-user-sport-event-profit-loss', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserSportEventProfitLossReport(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/get-user-casino-games-profit-loss', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserCasinoGamesProfitLossReport(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Casino Games Profit Loss: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.get('/get-user-match-bet-profit-loss', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserMatchBetProfitLossReport(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.get('/get-user-selection-bet-profit-loss', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserSelectionBetProfitLossReport(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});


exports.getProfitLossReport = async (req) => { 
    try {
  
      const { page , limit ,  fromDate, toDate} = req.query; 

    return await services.getProfitLossReport({ page, limit, fromDate, toDate }, req);
    } catch (error) {
      return {
        statusCode: statusCode.BAD_REQUEST,
        success: false,
        message: error.message,
      };
    }
  };




  router.get('/get-fancy-bets', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getFancyBets(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.put('/updateUserProfile',jwtVerify, async (req, res) => {
    try {
        const {betBidValue, color} = req.body;
        const result = await userService.updateUserProfile({userId:req.auth._id,betBidValue, color});  
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        logger.error( 
            LOG_ID, 
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getUserSportEventProfitLoss', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserSportEventProfitLossReports(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/get-user-bet-list', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getUserBetList(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/get-user-current-bet-list', jwtVerify, async (req, res) => {
    try {
        const result = await userService.getCurrentBetList(req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        console.log(err);
        logger.error(LOG_ID, `Error occurred while fetching User Rolling Commission: ${err.message}`);
        handleErrorResponse(res, err.status, err.message, err);
    }
});

module.exports = router;



