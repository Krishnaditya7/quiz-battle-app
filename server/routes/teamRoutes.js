import express from 'express';

import{
    createTeam,
    getAvailableTeams,
    joinTeam,
    setCurrentTeam,
    getMyTeam,
    leaveTeam,
    unsetCurrentTeam,
    transferLeadership,
    sendTeamMessage,
    getTeamChat
} from '../controllers/teamController.js';
import { protect } from '..middleware/auth.js';

const router = express.Router();

//middleware se authent9ication ke baad hi access kr paoge (jwt tokens se)
router.post('/create',protect,createTeam);
router.get('/available',protect,getAvailableTeams);
router.post('/join/:teamId',protect,joinTeam);
router.post('/currentTeam/:teamId',protect,setCurrentTeam);
router.get('/my-team',protect,getMyTeam);
router.post('/leave',protect,leaveTeam);
router.post('/unset',protect,unsetCurrentTeam);
router.post('/transfer/:teamId',protect,transferLeadership);
router.post('/chat/send',protect,sendTeamMessage);
router.get('/chat',protect,getTeamChat);


// A user can be in many teams

// A user has ONE currentTeam

// Many actions should rely on req.user.currentTeam

// :teamId is needed only when the user is choosing a team

// :teamId is NOT needed when the action is about current context