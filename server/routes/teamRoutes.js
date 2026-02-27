// ============================================================
// TEAM ROUTES
// Base: /api/team
// ============================================================

import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  createTeam,
  getTeam,
  browseTeams,
  requestJoinTeam,
  approveJoinRequest,
  leaveTeam,
  kickMember,
  inviteToTeam,
  updateTeam,
  getMyTeams,
  setCurrentTeam,
  playSolo,
} from '../controllers/teamController.js';

const router = express.Router();

// All team routes are protected
router.use(protect);

router.post('/create', createTeam);
router.get('/browse', browseTeams);
router.get('/my-teams', getMyTeams);
router.get('/:teamId', getTeam);
router.post('/:teamId/join-request', requestJoinTeam);
router.post('/:teamId/approve-join', approveJoinRequest);
router.post('/:teamId/leave', leaveTeam);
router.post('/:teamId/kick', kickMember);
router.post('/:teamId/invite', inviteToTeam);
router.patch('/:teamId/update', updateTeam);
router.post('/:teamId/set-current', setCurrentTeam);
router.post('/play-solo', playSolo);

export default router;