// npm install minimist 
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");
const workbook = require("excel4node/distribution/lib/workbook");
const { PDFDocument, rgb } = require("pdf-lib");
const { parse } = require("path");

// node CricInfo.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --excel=WorldCup.csv --dataFolder=data --dest=teams.json
let args = minimist(process.argv);

// download webpage data using axios
// read using jsdom
// make excel using excel4node
// make pdf using pdf-lib

let responsePromise = axios.get(args.source);
responsePromise.then(function(response){
    let html = response.data;

    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matchDivs = document.querySelectorAll("div.match-score-block");
    
    let matches = [];

    for(let i=0; i<matchDivs.length ; i++){
        let matchDiv = matchDivs[i];
        let match = {
            t1 : "",
            t2 : "",
            t1score : "",
            t2score : "",
            result : ""
        }

        let TeamName = matchDiv.querySelectorAll("p.name");
        match.t1 = TeamName[0].textContent;
        match.t2 = TeamName[1].textContent;

        let TeamScores = matchDiv.querySelectorAll("span.score");
        
        if(TeamScores.length == 2){
            match.t1score = TeamScores[0].textContent;
            match.t2score = TeamScores[1].textContent;
        }
        else if(TeamScores.length == 1){
            match.t1score = TeamScores[0].textContent;
            match.t2score = "";
        }
        else{
            match.t1score = "";
            match.t2score = "";
        }


        let resultSpan = matchDiv.querySelector("div.status-text > span");
        match.result = resultSpan.textContent;

        // match object , matches array
        matches.push(match);
    }

    let teams = [];

    for(let i=0; i<matches.length; i++){
        populateTeams(teams,matches[i]);
    }
    
    // teams array formed containing each teams name and its corresponding matches array (but the matches array is empty) 

    for(let i=0; i<matches.length; i++){
        populateMatches(teams,matches[i]);
    }

    // To dispaly teams array (contains objects so stringify first)
    // console.log(JSON.stringify(teams));

    //fs.writeFileSync(args.dest,JSON.stringify(teams),"utf-8");

    createExcelFile(teams);
    
    createFolders(teams);

}).catch(function(err){
    console.log(err);
});



function populateTeams(teams, match){

    //Find match.t1 index in teams , If that team is not present in array teams then push
    let t1indx = -1 ;
    for(let i = 0; i<teams.length ;i++){
        if(teams[i].name == match.t1){
            t1indx = i;
            break;
        }
    }

    if(t1indx == -1){
        teams.push({
            name : match.t1,
            matches : []
        })
    }

    //Find match.t2 index in teams , If that team is not present in array teams then push
    let t2indx = -1 ;
    for(let i = 0; i<teams.length ;i++){
        if(teams[i].name == match.t2){
            t2indx = i;
            break;
        }
    }

    if(t2indx == -1){
        teams.push({
            name : match.t2,
            matches : []
        })
    }

}

function populateMatches(teams, match){
    let t1indx = -1;
    for(let i = 0; i<teams.length ;i++){
        if(teams[i].name == match.t1){
            t1indx = i;
            break;
        }
    }

    teams[t1indx].matches.push(
        {
            vs : match.t2 ,
            selfScore : match.t1score,
            oppscore : match.t2score,
            result :  match.result
        }
    );


    let t2indx = -1;
    for(let i = 0; i<teams.length ;i++){
        if(teams[i].name == match.t2){
            t2indx = i;
            break;
        }
    }

    teams[t2indx].matches.push(
        {
            vs : match.t1 ,
            selfScore : match.t2score,
            oppscore : match.t1score,
            result :  match.result
        }
    );

}

function createExcelFile(teams){

    wb = new excel.Workbook();
    
    for(let i = 0;i<teams.length; i++){
        let sheet = wb.addWorksheet(teams[i].name);
        sheet.cell(1,1).string("VS");
        sheet.cell(1,2).string("Self Score");
        sheet.cell(1,3).string("Opp Score");
        sheet.cell(1,4).string("Result");

        let matchInfo = teams[i].matches;

        for(j=0; j<matchInfo.length; j++){
            sheet.cell(j+2,1).string(matchInfo[j].vs);
            sheet.cell(j+2,2).string(matchInfo[j].selfScore);
            sheet.cell(j+2,3).string(matchInfo[j].oppscore);
            sheet.cell(j+2,4).string(matchInfo[j].result);
        }

    }

    wb.write(args.excel);

}

function createFolders(teams){

    fs.mkdirSync(args.dataFolder);
    
    for(let i=0;i<teams.length;i++){

        let teamFN = path.join(args.dataFolder,teams[i].name);
        fs.mkdirSync(teamFN);

        for(let j=0;j<teams[i].matches.length;j++){
            let matchFileName = path.join(teamFN,teams[i].matches[j].vs + j + ".pdf");
            createScoreCard(teams[i].name,teams[i].matches[j],matchFileName);
        }

    }
}

function createScoreCard(teamName,team,matchFN){
    
    t1 = teamName;
    t2 = team.vs;
    t1score = team.selfScore;
    t2score = team.oppscore;
    result = team.result;

    let originalBytes = fs.readFileSync("Cric_Template.pdf");
    let promiseToLoadBytes = pdf.PDFDocument.load(originalBytes);
    promiseToLoadBytes.then(function(pdfDoc){
        let page = pdfDoc.getPage(0);
        
        page.drawText(teamName,{
            x: 300,
            y: 590,
            color: rgb(1,1,1),
            size: 18
        });
        
        page.drawText(team.vs,{
            x: 300,
            y: 550,
            color: rgb(1,1,1),
            size: 18
        });

        page.drawText(team.selfScore,{
            x: 300,
            y: 510,
            color: rgb(1,1,1),
            size: 18
        });

        page.drawText(team.oppscore,{
            x: 300,
            y: 470,
            color: rgb(1,1,1),
            size: 18
        });

        page.drawText(team.result,{
            x: 113,
            y: 400,
            color: rgb(1,1,1),
            size: 18
        });



        let promiseToSave = pdfDoc.save();
        promiseToSave.then(function(changedBytes){
            fs.writeFileSync(matchFN,changedBytes);
        })


    })

    
}












