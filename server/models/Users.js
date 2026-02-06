import mongoose from 'mongoose';

const userSchema=new mongoose.Schema({
    username: {
        type : String,
        required: true,
        unique: true,
        trim : true,
        minlength:3,
        maxlength:20,
    },
    email: {
        type: String,
        required : true,
        unique : true,
        lowercase : true,
        trim: true
    },
    password : {
        type: String,
        required: true,
        minlength: 6,
    },
    class: {
        type: String,
        required: true,
        enum : ['6', '7', '8', '9', '10', '11', '12', 'College', 'Other'], 
    },
    topics: [{
        type:String,
        required:true
    }],                           //so that ai can find the best teams to join for the player
   rating: {
    type:Number,
    default:0
   },
   stats: {
    gamesPlayed:{type: Number, default:0},
    wins:{type: Number, default:0},
    losses:{type: Number, default:0},
    draws:{type:Number, default:0},
    totalPoints:{type:Number, default:0}
   },
   teams:[{
    type: mongoose.Schema.Types.ObjectId,
    ref:'Team'
   }],
   currentTeam:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'Team',
    default:NULL
   },
   level: {
  type: Number,
  default: 1,
  min:1
 },
leader: {
   isOnline:{
    type:Boolean,
    default:false
   },
   lastActive:{
    type:Date,
    default:Date.now
   }
   },
   timestamps:true           //it is a part of the object userSchmea
});

const User = mongoose.model('User',userSchema);
export default User;