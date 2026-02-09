import Team from "../models/Team";
import User from "../models/Users";

// @desc Creating a new team
// @route POST/api/teams/create
// @access Private

export const createTeam = async (req,res) => {
    try{
        const { name, type, maxMembers } = req.body;

        // validation
        if(!name){
            return res.status(400).json({
                success: false,
                message: 'team name is required'
            });
        }
        const existingTeam = await Team.findOne({ name });
        if(existingTeam){
            return res.status(400).json({
                success: false,
                message: 'Team name already taken'
            });
        }
        // not considering logic of claude: if user already in the team then he can't create a new team
        //let's create the team

        const team = await Team.create({
            name,
            level: level || 1,  //type changed to level
            leader: req.user._id,
            members:[req.users._id],
            maxMembers: maxMembers || 4
        });
//i loved this current team concept it will make my logic easy : if (user in currentTeam) then he will play for that team only else if he want to
//  play being with another team he should change his current team with the team he wants to play
        await User.findByIdAndUpdate(req.user._id, { 
            currentTeam: team._id,
            $addToSet: { teams: team._id }   //push alllows duplicate but  add to set ensures uniqueness
        });
        const populatedTeam = await Team.findById(team._id).populate('leader members','username rating');

        res.status(201).json({
            success: true,
            message: 'Team created successfully',
            data: { team: populatedTeam }
        });
    }     catch (error) {
          console.error('Create team error:',error);
          res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
          });
        }
    };
// @desc Get available team to join
// @route Get/api/teams/available
// @access Private
export const getAvailableTeams = async (req,res) => {
    try{
        const { level } = req.query;

        const query = {
            isActive: true,
            $expr: { $lt: [{$size: "$members"}, "$maxMembers"] }   //Not Null
        };
        if(level){
           query.level = level;
        }
        const teams = await Team.find(query)
        .populate('leader members', 'username rating')
        .sort({ createdAt: -1 })
        .limit(20);

        res.status(200).json({
            success: true,
            data: { teams }
        });
    } catch(error){
       console.error('Get available teams error:',error);
       res.status(500).json({
        success: false,
        message: 'server error',
        error: error.message
       });
    }
};
// @desc Join a team
// @route Post/api/team/join/:teamId
// @access Private

export const joinTeam = async (req,res) => {
    try{
        const { teamId } = req.params;
        if(team.members.length >= team.maxMembers){
    return res.status(400).json({
        success: false,
        message: 'team is full'
    });
   }
        // our current team can be same as what and when we want to play we will choose from 
        // which team should we play and THAT will become the current team
        await Team.findByIdAndUpdate(teamId, {
            $addToSet: { members:req.user._id }
        });
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { teams: teamId }
        });
        const team = await Team.findById(teamId);
        if(!team){
        return res.status(404).json({
             success: false,
             message: 'team not found'
        });
      }
    const populatedTeam = await Team.findById(team._id).populate('leader members', 'username rating');

    res.status(200).json({
        success: true,
        message: 'Joined team successfully',
        data: { team: populatedTeam }
    });
  } catch(error){
    console.error('Join team error:',error);
    res.status(500).json({
        success:false,
        message:'server error',
        error: error.message
    })
  }
};
export const setCurrentTeam = async (req,res) => {
    const { teamId }= req.params;
     
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }
    const user = await User.findById(req.user._id);

    if(!user.teams.some(t => t.equals(teamId))) {
        return res.status(403).json({
            success: false,
            message: 'You are not a member of this team'
        });
    }
    user.currentTeam = teamId;
    await user.save();

    res.json({
        success: true,
        message: 'current team set successfully',
        data: {
            currentTeam: teamId
        }
    });
};
// @desc Get my current team
// @route GET/api/teams/my-team
// @access Private
export const getMyTeam = async (req,res) => {
    try{
        if(!req.user.currentTeam){
            return res.status(404).json({
                success: false,
                message: 'You are not in team'
            });
        }
        const team = await Team.findById(req.user.currentTeam).populate('leader members','username rating isOnline lastActive');

        if(!team){
            return res.status(404).json({
                success: false,
                message: 'team not found'
            });
        }
        res.status(200).json({
            success: true,
            data: { team }
        });
    } catch(error){
        console.error('get my team error:',error);
        res.status(500).json({
            success: false,
            message: 'server error',
            error: error.message
        });
    }
};
// @desc Leave team bro (permanently)
// @route Post/api/teams/leave
// @access Private
export const leaveTeam = async (req,res) => {
    try{
        const { teamId }= req.user.currentTeam;

        const team = await Team.findById(teamId);
        if(!team){
            return res.status(404).json({
                succes:false,
                message: 'Team not found'
            });
        }
        if(!team.members.some(m=>m.equals(req.user._id))) {
            return res.status(400).json({
                success: false,
                message: 'You are not a member of this team'
            });
        }
        if(team.leader.equals(req.user._id)){
            if(team.members.length > 1){
                team.members = team.members.filter(m=> !m.equals(req.user._id));
                team.leader = team.members[0];
                await team.save();
            } else{
                await team.findByIdAndDelete(team._id);
            }
        } else{
            team.members = team.members.filter(m=> !m.equals(req.user._id));
            await team.save();
        }
        // updating the user
        const user = await user.findById(req.user._id);
        user.teams = user.teams.filter(t=>!t.equals(team._id));

        if(user.currentTeam && user.currentTeam.equals(team._id)){
            user.currentTeam=null;
        }
        await user.save();

        res.json({
            succes: true,
            message: 'Left team successfully'
        });
    } catch (error){
        console.error('error ocuured while leavind team :',error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }

};

// @route Post api/users/unset-current-team
// @desc changing team in current team to play with other team
// @access Private
export const unsetCurrentTeam = async (req,res) => {
    try{
        req.user.currentTeam = null;
        await req.user.save();

        res.json({
            success: true,
            message: 'Current team unset'
        })
    } catch(error){
        console.error('Error occured while changing the current team :',error);
        res.status(500).json({
            success: false,
            message: 'server error'
        });
    }
};
// @desc team leadership transfer krna
// @route Post/api/user/transferLeadership
// @access Private

export const transferLeadership = async (req,res) => {   //yeh ek request ho toh hai
    try{
    //  us member ka id lena bhi zaruri hai jisko banana hai team leader 
        const { teamId } = req.params;
        const { newLeaderId } = req.body;

        if(!newLeaderId){
            return res.status(400).json({
                success: false,
                message: 'Leader id is reuired'
            });
        }
        const team = await Team.findById(teamId);
        if(!team){
            return res.status(404).json({
               success: false,
               message: 'Team not found' 
        });
    }
    if(!team.leader.equals(req.user._id)){
        return res.status(403).json({
            success: false,
            message: 'Only team leader can transfer the leadership'
        });
    }
    if(!team.members.some(m=> m.equals(newLeaderId))){
        return res.status(400).json({
            success: false,
            message: 'new team leader should first be in the the team'
        });
    }
    if(team.leader.equals(newLeaderId)){
        return res.status(400).json({
            success: false,
            message: 'user is already the leader'
        });
    }
    team.leader = newLeaderId;
    await team.save();

    res.json({
        success: true,
        message: 'team leadership transferred successfully'
    });
} catch(error){
    console.error('Transfer leadership error:', error);
    res.status(500).json({
    success: false,
    message: 'Server error'
});
}
};
// @desc send message in the chat
// @route POST/api/team/chat

export const sendTeamMessage = async (req,res) => {
    try{
        const { message } = req.body;

        if(!message || message.trim() === ''){
            return res.status(400).json({
                success: false,
                message: 'message cannot be empty' 
            });
        }
        if(!req.user.currentTeam) {
            return res.status(400).json({
                success: false,
                message: 'User is not in the team'
            });
        }
        const team = await Team.findById(req.user.currentTeam);
        if(!team){
            return res.status(404).json({
                success: true,
                message: 'Team not found'
            });
        }
        // now let's add message to the chat
        team.chat.push({
            sender: req.user._id,
            message: message.trim()
        });
        await team.save();

        const populatedTeam = await Team.findById(team._id).populate('chat.sender','username');
        res.status(200).json({
            success: true,
            data: {
                message: populatedTeam.chat[populatedTeam.chat.length - 1]
            }
        });
    } catch(error){
        console.error('Send team message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
    }
};
// @desc get team chat messages
// @route get/api/teams/chat
// @access Private

export const getTeamChat = async (req,res) => {
    try{
        if(!req.user.currentTeam){
            return res.status(400).json({
                success: false,
                message: 'you are not in any team'
            });
        }
        const team = await Team.findById(req.user.currentTeam).populate('chat.sender','username');
        if(!team){
            return res.status(404).json({
                success: false,
                message: 'team not found'
            });
        }
        res.status(200).json({
            success: true,
            data: {
                message: team.chat
            }
        });
    } catch(error){
        console.error('Get team chat error:',error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error : error.message
        });
    }
};