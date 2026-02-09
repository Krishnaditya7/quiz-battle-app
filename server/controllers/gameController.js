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
        turnNumber: index+1
    }));
};

// ab dusre team ya bande ko chance do
const getNextTurn = (game) => {
    // get all participants
    const participants = [];

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
        const teamsWithPlayers = game.participants.teams.filter(t => )
    }
}