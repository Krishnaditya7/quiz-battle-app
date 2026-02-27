import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/Users';

const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        Process.env.JWT_SECRET,
        { expiresIn : '7d'}
        
    );
};
const sendToken = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:  7* 24 * 60 * 60 * 1000,
    });
};
//Sign-up
export const SignUp = async (req,res) => {
    try{
        const { username, email, topic, password, className, dob, topics } = req.body;
        if(!username || !email || !password || !className || !dob || !topics?.length) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required to be filled'
            }); 
        }
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username }]
        });
        if(existingUser){
            const field = existingUser.email === email.toLowerCase() ? 'Email': 'Username';
            return res.status(409).json({
                success: false,
                message: `${field} is already taken`
            });
        }

        const validClasses = ['6', '7', '8', '9', '10', '11', '12', 'College', 'Other'];
        if(!validClasses.includes(className)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid class.'
            });
        }
        const parsedDOB = new Date(dob);
        if(isNaN(parsedDOB.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid DOB'});
        }
        // level excat match karane ki zarurat nhi aas paas bhi kara sakte ho and consider team level as avg of whole member
        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            class: className,
            dob: parsedDOB,
            topics: Array.isArray(topics)? topics : [topics],
        });
        const token = generateToken(user._id);
        sendTokenCookie(res, token);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                class: user.class,
                dob: user.dob,
                topics: user.topics,
                level: user.level,
                xp: user.xp,
                status: user.status,
            }
        });
    } catch(error){
        console.log('SignUp error: ', err);
        return res.status(500).json({success: false, message: 'Server error during signUp'})
    }
};
export const login = async (req,res) => {
    try{
        const { emailOrUsername, password } = req.body;

        if(!emailOrUsername || !password){
            return res.status(400).json({
                success: false,
                message: 'Username and password is required'
            });
        }
        const user = await User.findOne({
            $or: [
                { email: emailOrUsername.toLowerCase() },
                { username: emailOrUsername }
            ]
        }).select('+password');  //including password as by default it is excluded

        if(!user){
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
             return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
        });
    }
const token = generateToken(user._id);
    sendTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully!',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        class: user.class,
        dob: user.dob,
        topics: user.topics,
        level: user.level,
        xp: user.xp,
        stats: user.stats,
        friends: user.friends,
        teams: user.teams,
        currentTeam: user.currentTeam,
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};
export const logout= async (req,res) => {
    try{
        res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({ success: true, message: 'Logged out successfully' });

  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

export const getMe = async (req, res) => {
    try{
        const user = await User.findById(req.userId)
        .select('-password')
      .populate('teams', 'name dp level topic')
      .populate('currentTeam', 'name dp level topic members')
      .populate('friends', 'username level isOnline lastActive');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user });

  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};