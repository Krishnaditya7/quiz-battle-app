import bcrypt from 'bcryptjs';
import User from '../models/Users';
import { generateToken } from '../utils/jwt';

// @access -> it will be public
//@routes -> POST/API/AUTH/SIGNUP
//@desc we are registering up a new user
export const signup = async (req,res) => {
    try{
        const {username,email,password,class: userClass,topics} = req.body;
        // req.body sends the data sent by the user
        //let's validate
       // success is an API for the frontend UI
       //validation

       if(!username || !email || !password || !topics || !userClass || topics.lenght===0){
        return res.status(400).json({
            success: false,
            message: 'FILL ALL THE DETAILS'
        });
       }

       const existingUsername = await User.findOne({ username });
       if(existingUsername){
        return res.status(400).json({
            success: false,
            message: 'Username already taken'
        });
       }

       const existingEmail = await User.findOne({ email });
       if(existingEmail){
        return res.status(400).json({
            success: false,
            message: 'Email already taken'
        });
       }

       const salt = await bcrypt.genSalt(10);
       const hashedPassword = await bcrypt.hash(password, salt);

       const user = await User.create({
         username,
         email,
         password: hashedPassword,
         class: userClass,
         topics
       });
        
       const token = generateToken(user._id);

       res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                class: user.class,
                topics: user.topics,
                rating: user.rating,
                status: user.status
            },
            token
        }
       });
    }  catch(error){
        console.error('Sign up failed:', error);
        res.status(500).json({
            success:false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

//@access - public
//@routing - POST/api/auth/login
//@desc login user

export const login = async (req,res) => {
    try{
        const{email,password} = req.body;

        if(!email || !password){    //kuch bhi nhi doge toh false aayega
            return res.status(400).json({
                success: false,
                message: 'Please provide email and address'
            });
        }
        const user= await User.findOne({email});
        if(!user){
            return res.status(401).json({
                success: false,
                message: 'Password or Username is invalid'
            });
        }
        const isPassword= await bcrypt.compare(password, user.password);
        if(!isPassword){
            return res.status(401).json({
                success: false,
                message: 'Password or Username is invalid'
            });
        }
        user.isOnline = true;
        user.lastActive = new Date();
        await user.save();

        const token = generateToken(user._id);
        res.status(200).json({
            success: true,
            message: 'login successfull',
            data:{
                user:{
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    class: user.class,
                    topics: user.topics,
                    rating: user.rating,
                    stats: user.stats,
                    currentTeam: user.currentTeam
                },
                token
            }
        });
    } catch(error){
        console.error('Login error: ',error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }

    };
    //@desc get the current user
    //@route GET/api/auth/me
    //@access Private
    export const getMe = async (req,res) => {
        try{
           const user = await User.findOne(req.user._id).select('-password').populate('currentTeam','name type members');
              
           res.status(200).json({
             success: true,
             data:{
                user
             }
           });
        } catch(error){
            console.error('GetMe error:',error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: error.message
            });
        }
    };
//@desc  Logout user
//@route Post/api/auth/logout
//@access Private

export const logout = async (req, res) => {
    try{
        await User.findByIdAndUpdate(req.user._id, {
            isOnline: false,
            lastActive: new Date()
        });
     res.status(200).json({
        success: true,
        message: 'logout successful'
     });
    } catch(error){
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout',
            error: error.message
        })
    }
};