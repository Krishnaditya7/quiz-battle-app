import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  createTeam, getTeam, browseTeams, requestJoinTeam,
  approveJoinRequest, leaveTeam, kickMember, updateTeam,
  getMyTeams, inviteToTeam, setCurrentTeam, playSolo,
  acceptInvite, rejectInvite
} from '../controllers/teamController.js';

// Export a function that accepts io
export const createTeamRoutes = (io) => {
  const router = express.Router();

  router.post('/create', protect, createTeam);
  router.get('/my-teams', protect, getMyTeams);
  router.get('/browse', protect, browseTeams);
  router.post('/play-solo', protect, playSolo);
  router.get('/:teamId', protect, getTeam);
  router.post('/:teamId/join-request', protect, requestJoinTeam);
  
  // Pass io to controllers that need real-time notifications
  router.post('/:teamId/approve-join', protect, (req, res) => approveJoinRequest(req, res, io));
  router.post('/:teamId/invite', protect, (req, res) => inviteToTeam(req, res, io));
  router.post('/:teamId/accept-invite', protect, (req, res) => acceptInvite(req, res, io));
  router.post('/:teamId/reject-invite', protect, (req, res) => rejectInvite(req, res, io));
  
  router.post('/:teamId/kick', protect, kickMember);
  router.post('/:teamId/leave', protect, leaveTeam);
  router.patch('/:teamId/update', protect, updateTeam);
  router.post('/:teamId/set-current', protect, setCurrentTeam);

  return router;
};