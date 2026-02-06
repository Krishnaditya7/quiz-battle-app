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
            $push: { teams: team }
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
export const getAvailableTeam = async (req,res) => {
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
    if(team.members.length >= team.maxMembers){
        return res.status(400).json({
            success: false,
            message: 'team is full'
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
    const { teamId }= req.body;

    if(!teamId){
        return res.status(400).json({
            success: false,
            message: 'teamID is required'
        });
    }
    const 
}