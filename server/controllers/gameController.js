import Game from '../models/Game';
import User from '../models/Users';
import Team from '../models/Team';

// helper function bana to shufflle array and assign  the turn numbers
const generateTurnSequence = (players) => {
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i>0; i--){
        const j = Math.floor(Math.random() * (i+1));
        [shuffled[i],shuffled[j]] = [shuffled[j],shuffled[i]];
    }
    // assigning turn numbers (1,2,3,4)
    return shuffled.map((players,index) => ({
        ...players,
        turnNumber:index+1
    }));
};
//distributing questions
const distributeQuestionsPerPlayer = (game,totalQuestions,totalPlayer) => {
    if(totalQuestions%totalPlayer==0){
        return totalQuestions/totalPlayer;
    }
    if(player.user.toString() === leaderId.toString()){
       return player.questionsRemaining += (totalQuestions % totalPlayer);
    }
};


export const getNextTurn = (game) => {
    // get all participants
    const teams = game.participants.teams;
    const soloPlayers = game.participants.soloPlayers;

    

    // add solo players 
    game.participants.soloPlayers.forEach(player => {
        if(player.questionsRemaining > 0){
            participants.push({
                type: 'solo',
                participantId: player.user,
                playerId: player.user,
                turnNumber: 1
            });
        }
    });

    // adding team players
    game.participants.teams.forEach(team => {
        team.players.forEach(player => {
            if(player.questionsRemaining>0){
                participants.push({
                    type: 'team',
                    participantId: team.team,
                    teamIndex: game.participants.teams.indexOf(team),
                    playerId: player.user,
                    turnNumber: player.turnNumber
                });
            }
        });
    });

    if(participants.length === 0){
        return null;  // game should end 
    }
    // creating sequece for each team to have turns one by one
    const currentTurn = game.currentTurn;

    if(!currentTurn || !currentTurn.playerId) {
        // for the first turn pick a team randomly
        const teamsWithPlayers = game.participants.teams.filter(t => t.players.some(p => p.questionsRemaining>0));

        if(teamsWithPlayers.length===0){
            //that means he is a solo player
            return participants[0];
        }

        //random selection of the first team
        const firstTeamIndex = Math.floor(Math.random() * teamsWithPlayers.length);
        const firstTeam = teamsWithPlayers[firstTeamIndex];

        //agr do player hai toh ya toh number 1 choose hoga ya 0 randomnness se

        //now  let's find the player with turn 1 in the selected team
        const firstPlayer = firstTeam.players.find(p=> p.turnNumber === 1 && p.questionsRemaining>0);
        
    }
}