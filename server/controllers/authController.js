import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/Users.js';

const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn : '7d'}
        
    );
};
const sendTokenCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'false',
        sameSite: 'lax',
        maxAge:  7* 24 * 60 * 60 * 1000,
    });

    /*If your frontend and backend are on different domains (like):

Frontend:

localhost:3000  sameSite: 'none',
secure: true

Backend:

${BACKEND_URL}*/
};
export const SignUp = async (req, res) => {
  try {
    const { username, email, password, className, dob, topics } = req.body;

    console.log('📥 Signup request body:', req.body);

    // Validate all fields
    if (!username || !email || !password || !className || !dob || !topics) {
      console.log('❌ Missing fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(409).json({
        success: false,
        message: 'Email already exists',
      });
    }

    // Check username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      console.log('❌ Username taken:', username);
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    console.log('👤 Creating user...');
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      class: className,  // ← or className: className, depending on your model
      dob: new Date(dob),
      topics: Array.isArray(topics) ? topics : [],
      xp: 0,
      level: 1,
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalPoints: 0,
      },
    });

    console.log('✅ User created:', newUser._id);

    // Generate token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        level: newUser.level,
        xp: newUser.xp,
      },
      message: 'Account created successfully!',
    });

  } catch (err) {
    // DETAILED ERROR LOGGING
    console.error('❌ SIGNUP ERROR:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);

    res.status(500).json({
      success: false,
      message: 'Server error during signup',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
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