import { verifyToken } from "../utils/jwt";
import User from "../models/Users";

export const protect = async(req,res,next) => {
     let token;

     if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){  //token format : bearer token
        try{
            token = req.headers.authorization.split('')[1];   //extracting token
            
            const decoded = verifyToken.split(token);  //verifying token
            if(!decoded){
                return res.status(401).json({
                    success:false,
                    message: 'Authorization failed!, token failed'
                });
            }
            req.user = await User.findById(decoded.id).select('-password');
            if(!req.user){
                return res.status(401).json({
                    success:false,
                    message:'User not found'
                });
            }
            next();

        }
        catch(error) {
            console.error('Auth middleware error:', error);
            return res.status(401).json({
                success: false,
                message: 'Authorization failed'
            });

        }
     }

 else{
    return res.status(401).json({
        success:false,
        message:'Not authorized'
    });
}
};