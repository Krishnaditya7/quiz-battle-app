// ============================================================
// TEAM CONTROLLER
// Handles: create team, join team, leave team, kick member,
//          update team (DP/topic/minLevel), get team details,
//          get team list (for browsing), delete team
// ============================================================

import Team from '../models/Team.js';
import User from '../models/Users.js';
import Notification from '../models/Notification.js';
import mongoose from 'mongoose';
// ─────────────────────────────────────────────
// HELPER: Calculate team level (avg of members)
// ─────────────────────────────────────────────
const calculateTeamLevel = async (team) => {
  const memberIds = team.members.map(m => m.user);
  const users = await User.find({ _id: { $in: memberIds } }).select('level');
  const avgLevel = users.reduce((sum, u) => sum + u.level, 0) / users.length;
  return Math.round(avgLevel);
};

// ─────────────────────────────────────────────
// POST /api/team/create
// Body: { name, maxMembers, topics: [topic1, topic2, ...] }
// minPlayerLevelRequired is auto-calculated
// ─────────────────────────────────────────────
export const createTeam = async (req, res) => {
  try {
    const { name, maxMembers, topics } = req.body;
    const userId = req.userId;

    // ── Validate ──
    if (!name || !topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Team name and at least one topic are required' 
      });
    }

    // ── Check if team name already exists ──
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(409).json({ success: false, message: 'Team name already taken' });
    }

    // ── Create team ──

  const user = await User.findById(userId);
    const team = await Team.create({
      name,
      maxMembers: maxMembers || 4,
      topics: topics,
      members: [{
        user: userId,
        role: 'leader',
        status: 'active',
      }],
    });

    // ── Calculate team level (just creator for now) ──
    team.level = user.level;
    
    // ── Auto-calculate minPlayerLevelRequired = max(1, teamLevel - 5) ──
    team.minPlayerLevelRequired = Math.max(1, team.level - 5);
    
    await team.save();

    // ── Add team to user's teams array ──
    await User.findByIdAndUpdate(userId, {
      $push: { teams: team._id },
      currentTeam: team._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Team created successfully!',
      team,
    });

  } catch (err) {
    console.error('Create team error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/team/:teamId
// Get single team details with populated members
// ─────────────────────────────────────────────
export const getTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId)
      .populate('members.user', 'username level xp stats');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Recalculate team level dynamically
    team.level = await calculateTeamLevel(team);

    return res.status(200).json({ success: true, team });

  } catch (err) {
    console.error('Get team error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/team/browse
// Query params: ?topic=math (optional - filters by specific topic)
// Returns teams where topics array includes queried topic, teamLevel ≤ userLevel + 5
// ─────────────────────────────────────────────
export const browseTeams = async (req, res) => {
  try {
    const { topic } = req.query;
    const userId = req.userId;

    const user = await User.findById(userId);

    // ── Build filter ──
    const filter = {};
    
    // If topic specified, show teams that have this topic in their topics array
    if (topic) {
      filter.topics = topic;  // MongoDB automatically checks if array contains value
    }

    // User is not already in the team
    filter['members.user'] = { $ne: userId };

    let teams = await Team.find(filter)
      .populate('members.user', 'username level class');

    // Filter teams based on rules
    teams = teams.filter(team => {
      // 1. Team must not be full
      if (team.members.length >= team.maxMembers) return false;

      // 2. Calculate team avg level
      const avgLevel = team.members.reduce((sum, m) => sum + m.user.level, 0) / team.members.length;
      const teamLevel = Math.round(avgLevel);

      // 3. User can join teams where: teamLevel ≤ (userLevel + 5)
      if (teamLevel > user.level + 5) return false;

      // 4. User must meet team's minPlayerLevelRequired
      if (user.level < team.minPlayerLevelRequired) return false;

      return true;
    });

    return res.status(200).json({ success: true, teams : teams });

  } catch (err) {
    console.error('Browse teams error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/team/:teamId/join-request
// User sends join request to team (requires leader approval)
// Creates a notification for the team leader
// ─────────────────────────────────────────────
export const requestJoinTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;

    const team = await Team.findById(teamId).populate('members.user', 'level');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // ── Check if team is full ──
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ success: false, message: 'Team is full' });
    }

    // ── Check if user is already in team ──
    const alreadyMember = team.members.some(m => m.user._id.toString() === userId);
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'You are already in this team' });
    }

    // ── Get user ──
    const user = await User.findById(userId);

    // ── Calculate current team level ──
    const avgLevel = team.members.reduce((sum, m) => sum + m.user.level, 0) / team.members.length;
    const teamLevel = Math.round(avgLevel);

    // ── Check eligibility: teamLevel ≤ userLevel + 5 ──
    if (teamLevel > user.level + 5) {
      return res.status(403).json({ 
        success: false, 
        message: `Team level (${teamLevel}) is too high. Max allowed: ${user.level + 5}` 
      });
    }

    // ── Check if user meets minPlayerLevelRequired ──
    if (user.level < team.minPlayerLevelRequired) {
      return res.status(403).json({
        success: false,
        message: `Minimum level ${team.minPlayerLevelRequired} required`,
      });
    }

    // ── Create notification for team leader ──
    const leader = team.members.find(m => m.role === 'leader');
    
    await Notification.create({
      recipient: leader.user,
      sender: userId,
      type: 'team_join_request',
      team: teamId,
      message: `${user.username} wants to join ${team.name}`,
      status: 'pending',
    });

    return res.status(200).json({
      success: true,
      message: 'Join request sent to team leader',
      teamId,
    });

  } catch (err) {
    console.error('Request join team error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/team/:teamId/approve-join
// Body: { userIdToApprove }
// Team leader approves a join request
// ─────────────────────────────────────────────
export const approveJoinRequest = async (req, res, io) => {
  try {
    const { teamId } = req.params;
    const { userIdToApprove } = req.body;
    const leaderId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // ── Check if requester is leader ──
    const leader = team.members.find(m => m.user.toString() === leaderId);
    if (!leader || leader.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only leader can approve join requests' });
    }

    // ── Check if team is full ──
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ success: false, message: 'Team is full' });
    }

    // ── Check if user already in team ──
    const alreadyMember = team.members.some(m => m.user.toString() === userIdToApprove);
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'User is already in this team' });
    }

    // ── Add user to team ──
    team.members.push({
      user: userIdToApprove,
      role: 'member',
      status: 'active',
    });

    // Recalculate team level and minPlayerLevelRequired
    team.level = await calculateTeamLevel(team);
    team.minPlayerLevelRequired = Math.max(1, team.level - 5);
    await team.save();

    // ── Add team to user ──
    await User.findByIdAndUpdate(userIdToApprove, {
      $push: { teams: team._id },
    });

    // Update notification status to 'accepted'
    await Notification.updateOne(
      { 
        recipient: leaderId, 
        sender: userIdToApprove, 
        team: teamId, 
        type: 'team_join_request',
        status: 'pending'
      },
      { status: 'accepted' }
    );

    // Create notification for the user who got approved
    const user = await User.findById(userIdToApprove);
    await Notification.create({
      recipient: userIdToApprove,
      sender: leaderId,
      type: 'team_invite_accepted',
      team: teamId,
      message: `Your request to join ${team.name} has been approved!`,
    });

    if (io) {
      io.to(`user:${userIdToApprove}`).emit('notification:new', { notification });
    }

    return res.status(200).json({ success: true, message: 'Approved!', team });
  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } 
};

// ─────────────────────────────────────────────
// POST /api/team/:teamId/leave
// User leaves a team
// ─────────────────────────────────────────────
export const leaveTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const member = team.members.find(m => m.user.toString() === userId);
    if (!member) {
      return res.status(400).json({ success: false, message: 'You are not in this team' });
    }

    // ── If leader leaves, transfer leadership or delete team ──
    if (member.role === 'leader') {
      if (team.members.length === 1) {
        // Last member → delete team
        await Team.findByIdAndDelete(teamId);
        await User.findByIdAndUpdate(userId, {
          $pull: { teams: teamId },
          $unset: { currentTeam: 1 },
        });
        return res.status(200).json({ success: true, message: 'Team disbanded' });
      } else {
        // Transfer leadership to next member
        const nextLeader = team.members.find(m => m.user.toString() !== userId);
        nextLeader.role = 'leader';
      }
    }

    // ── Remove user from team ──
    team.members = team.members.filter(m => m.user.toString() !== userId);
    team.level = await calculateTeamLevel(team);
    team.minPlayerLevelRequired = Math.max(1, team.level - 5);
    await team.save();

    // ── Remove team from user ──
    const user = await User.findByIdAndUpdate(userId, {
      $pull: { teams: teamId },
    }, { new: true });

    // If this was currentTeam, unset it
    if (user.currentTeam?.toString() === teamId) {
      user.currentTeam = null;
      await user.save();
    }

    return res.status(200).json({ success: true, message: 'Left team successfully' });

  } catch (err) {
    console.error('Leave team error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/team/:teamId/kick
// Body: { userIdToKick }
// Leader kicks a member
// ─────────────────────────────────────────────
export const kickMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userIdToKick } = req.body;
    const leaderId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // ── Check if requester is leader ──
    const leader = team.members.find(m => m.user.toString() === leaderId);
    if (!leader || leader.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only leader can kick members' });
    }

    // ── Check if target is in team ──
    const targetMember = team.members.find(m => m.user.toString() === userIdToKick);
    if (!targetMember) {
      return res.status(404).json({ success: false, message: 'User not found in team' });
    }

    // ── Can't kick yourself ──
    if (userIdToKick === leaderId) {
      return res.status(400).json({ success: false, message: 'Use leave endpoint instead' });
    }

    // ── Remove member ──
    team.members = team.members.filter(m => m.user.toString() !== userIdToKick);
    team.level = await calculateTeamLevel(team);
    team.minPlayerLevelRequired = Math.max(1, team.level - 5);
    await team.save();

    // ── Remove team from kicked user ──
    const kickedUser = await User.findByIdAndUpdate(userIdToKick, {
      $pull: { teams: teamId },
    }, { new: true });

    if (kickedUser.currentTeam?.toString() === teamId) {
      kickedUser.currentTeam = null;
      await kickedUser.save();
    }

    return res.status(200).json({ success: true, message: 'Member kicked successfully' });

  } catch (err) {
    console.error('Kick member error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/team/:teamId/update
// Body: { dp?, addTopic?, removeTopic? }
// Leader updates team settings - can add or remove one topic at a time
// ─────────────────────────────────────────────
export const updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { dp, addTopic, removeTopic } = req.body;
    const userId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // ── Check if requester is leader ──
    const leader = team.members.find(m => m.user.toString() === userId);
    if (!leader || leader.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only leader can update team' });
    }

    // ── Update fields ──
    if (dp !== undefined) team.dp = dp;
    
    // Add a topic (if not already present)
    if (addTopic) {
      if (!team.topics.includes(addTopic)) {
        team.topics.push(addTopic);
      }
    }
    
    // Remove a topic (must have at least 1 topic remaining)
    if (removeTopic) {
      if (team.topics.length === 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Team must have at least one topic' 
        });
      }
      team.topics = team.topics.filter(t => t !== removeTopic);
    }

    await team.save();

    return res.status(200).json({ success: true, message: 'Team updated', team });

  } catch (err) {
    console.error('Update team error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/team/my-teams
// Get all teams the user is part of
// ─────────────────────────────────────────────
export const getMyTeams = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).populate({
      path: 'teams',
      populate: { path: 'members.user', select: 'username level' },
    });

    return res.status(200).json({ success: true, teams: user.teams });

  } catch (err) {
    console.error('Get my teams error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/team/:teamId/invite
// Body: { userIdToInvite }
// Leader sends invite - this bypasses ALL level restrictions
// ─────────────────────────────────────────────
export const inviteToTeam = async (req, res,io) => {
  try {
    const { teamId } = req.params;
    const { userIdToInvite } = req.body;
    const leaderId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const leader = team.members.find(m => m.user.toString() === leaderId);
    if (!leader || leader.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only leader can invite' });
    }

    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ success: false, message: 'Team is full' });
    }

    const alreadyMember = team.members.some(m => m.user.toString() === userIdToInvite);
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'User already in team' });
    }

    

  const isValidId = mongoose.Types.ObjectId.isValid(userIdToInvite);
  const targetUser = isValidId 
  ? await User.findById(userIdToInvite)
  : await User.findOne({ username: userIdToInvite });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
   const actualUserId = targetUser._id.toString();
    // Check if invite already pending
    const existingInvite = await Notification.findOne({
      recipient: actualUserId,
      sender: leaderId,
      team: teamId,
      type: 'team_invite',
      status: 'pending'
    });
    if (existingInvite) {
      return res.status(400).json({ success: false, message: 'Invite already sent' });
    }

    const leaderUser = await User.findById(leaderId).select('username');

    // Create notification — don't add user yet
    await Notification.create({
      recipient: actualUserId,
      sender: leaderId,
      type: 'team_invite',
      team: teamId,
      message: `${leaderUser.username} invited you to join ${team.name}`,
      status: 'pending',
    });
    if (io) {
      io.to(`user:${actualUserId}`).emit('notification:new', { Notification });
    }

    return res.status(200).json({
      success: true,
      message: 'Invite sent successfully',
    });

  } catch (err) {
    console.error('Invite error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/team/:teamId/set-current
// Set a team as user's current active team
// ─────────────────────────────────────────────
export const setCurrentTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId);

  if (!user.teams.map(t => t.toString()).includes(teamId)) {   // BUG FIX 2: .includes() on ObjectId array needs toString comparison
            return res.status(403).json({ success: false, message: 'You are not in this team' });
        }

    user.currentTeam = teamId;
    await user.save();

    return res.status(200).json({ success: true, message: 'Current team set', currentTeam: teamId });

  } catch (err) {
    console.error('Set current team error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// POST /api/team/play-solo
// User switches to solo mode (clears currentTeam)
// ─────────────────────────────────────────────
// Set current team to null (play solo)
export const playSolo = async (req, res) => {
  try {
    const userId = req.userId;

    await User.findByIdAndUpdate(userId, { currentTeam: null });

    res.json({
      success: true,
      message: 'Playing solo - current team cleared'
    });
    console.log("Aa chuka hoo tere saamne ->", userId);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear team'
    });
  }
};
// POST /api/team/:teamId/accept-invite
export const acceptInvite = async (req, res,io) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ success: false, message: 'Team is now full' });
    }

    // Update notification status
    await Notification.updateOne(
      { recipient: userId, team: teamId, type: 'team_invite', status: 'pending' },
      { status: 'accepted', isRead: true }
    );

    // Add user to team
    team.members.push({ user: userId, role: 'member', status: 'active' });
    team.level = await calculateTeamLevel(team);
    team.minPlayerLevelRequired = Math.max(1, team.level - 5);
    await team.save();

    // Add team to user
    await User.findByIdAndUpdate(userId, {
      $push: { teams: team._id }
    });

    // Notify leader
    const leader = team.members.find(m => m.role === 'leader');
    const newMember = await User.findById(userId).select('username');
    await Notification.create({
      recipient: leader.user,
      sender: userId,
      type: 'team_invite_accepted',
      team: teamId,
      message: `${newMember.username} accepted your invite to ${team.name}`,
    });
     if (io) {
      io.to(`user:${leader.user}`).emit('notification:new', { notification });
    }

    return res.status(200).json({ success: true, message: 'Joined team!', team });

  } catch (err) {
    console.error('Accept invite error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/team/:teamId/reject-invite
export const rejectInvite = async (req, res,io) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;

    await Notification.updateOne(
      { recipient: userId, team: teamId, type: 'team_invite', status: 'pending' },
      { status: 'rejected', isRead: true }
    );

    // Notify leader of rejection
    const team = await Team.findById(teamId);
    const leader = team.members.find(m => m.role === 'leader');
    const user = await User.findById(userId).select('username');

    await Notification.create({
      recipient: leader.user,
      sender: userId,
      type: 'team_invite_rejected',
      team: teamId,
      message: `${user.username} declined your invite to ${team.name}`,
    });
       if (io) {
      io.to(`user:${leader.user}`).emit('notification:new', { notification });
    }
    return res.status(200).json({ success: true, message: 'Invite rejected' });

  } catch (err) {
    console.error('Reject invite error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};