const _networks = require('./networks');
const networks = _networks.networks;
const express = require('express');
const app = express();
const port = process.env.PORT || 80;
const axios = require('axios');
var uuid = require('uuid');
var bodyParser = require('body-parser')

app.use(bodyParser.json())


let token = "";
let networkId = "";
let templateId="";
let vendorId = "";
let testId = "";
let UID = "";

const loginUser = async (username,password) => {
    const login = {
        "email": username,
        "password": password
    };
    try {
        const res = await axios.post('https://api.testelium.com/api/auth/login', login);
        return(res.headers.authorization);
    } catch (err) {
        throw "invalid credentials";
    }
};

const NetworkId = async (MccMnc,ported,original) => {
    try {
        //const res = await axios.get('https://api.testelium.com/api/networks',{ headers: { Authorization: token}});
        rta =  networks.data.filter(it => it.mcc_mnc === MccMnc);
        if(original!="null" && ported!=0){
            rta = rta.filter(bb=> bb.original_mcc_mnc === original)
        }
        else if(ported===0){
            rta = rta.filter(bb=> bb.ported === 0)
        }
        return(""+rta[0].id);
    } catch (err) {
        throw "network doesn't exist";
    }
};

const TemplateId = async (name) => {
    try {
        const res = await axios.get('https://api.testelium.com/api/templates',{ headers: { Authorization: token}});
        rta =  res.data.data.filter(it => it.name === name);
        return(""+rta[0].id);
    } catch (err) {
        throw "template doesn't exist";
    }
};

const VendorId = async (name) => {
    try {
        const res = await axios.get('https://api.testelium.com/api/vendors',{ headers: { Authorization: token}});
        rta =  res.data.data.filter(it => it.name === name);
        return(""+rta[0].id);
    } catch (err) {
        throw "vendor doesn't exist";
    }
};

const CreateTestId = async (token,networkId,vendorId,templateId) => {
    UID = uuid.v4();
    const task ={
        "name": "test-"+UID,
        "tasks": [
            {
                "network_id": networkId,
                "vendor_id": vendorId,
                "template_id": templateId
            }
        ]
    }
    try {
        const res = await axios.post('https://api.testelium.com/api/tests/create',JSON.stringify(task),{ headers: { Authorization: token}
        });
        return(res.data.data.id);
    } catch (err) {
        throw "couldn't create test";
    }
};


const CreatSched = async (token,testId,report_interval,run_interval,max_delay,emails) => {
    const sched = {
        "name": "Schedule-"+UID,
        "test_id": testId,
        "runs_interval": run_interval,
        "reports_interval": report_interval,
        "max_delay": max_delay,
        "fails_alarm": 1,
        "content_changed_alarm": 1,
        "emails": emails
    }
    try {
        const res = await axios.post('https://api.testelium.com/api/schedules/create',JSON.stringify(sched),{ headers: { Authorization: token}
        });
        return(res.data);
    } catch (err) {
        throw "couldn't create schedule";
    }
};

const GetScheduleID = async (token,testId) => {
    try {
        const res = await axios.get('https://api.testelium.com/api/schedules',{ headers: { Authorization: token}});
        rta =  res.data.data.filter(it => it.name === "Schedule-"+testId);
        return([rta[0].id,rta[0].test_id]);
    } catch (err) {
        throw "schedule doesn't exist";
    }
};

const DeleteSched = async (schedId) => {
    const task ={
        "id":schedId
    }
    try{
        await axios.post('https://api.testelium.com/api/schedules/delete',JSON.stringify(task),{ headers: { Authorization: token}
        });
        return(true);
    }
    catch(err){
        throw "couldn't delete schedule";
    }
};

const DeleteTest = async (testId) => {
    const task ={
        "id":testId
    }
    try{
        await axios.post('https://api.testelium.com/api/tests/delete',JSON.stringify(task),{ headers: { Authorization: token}
        });
        return(true);
    }
    catch(err){
        throw "couldn't delete test";
    }
};

const ToggleSched = async (token,schedId) => {
    const task ={
        "id":schedId
    }
        await axios.post('https://api.testelium.com/api/schedules/toggle',JSON.stringify(task),{ headers: { Authorization: token}
        });
        return(true);
};

app.post('/newtest', async (req, res) => {
    try{
    let auth = req.headers.authorization;
    let split = auth.split(' ');
    let base64 = split[1];
    let buff = Buffer.from(base64, 'base64');  
    let text = buff.toString('utf-8');
    let credentials = text.split(':');
    let username = credentials[0];
    let password = credentials[1];

   token = await loginUser(username,password);

   let mcc_mnc = req.body.mcc+"-"+req.body.mnc;
   let ported = req.body.ported;
   let original = "null";

   if(ported===1){
       original = req.body.original.mcc+"-"+req.body.original.mnc;
   }

   let template = req.body.template;
   let prefix = req.body.prefix;
   let report_interval = req.body.report_interval;
   let run_interval = req.body.run_interval;
   let max_delay = req.body.max_delay;
   let emails = req.body.emails;

   networkId = await NetworkId(mcc_mnc,ported,original);
   templateId = await TemplateId(template);
   vendorId = await VendorId(prefix);
   testId = await CreateTestId(token,networkId,vendorId,templateId);
   await CreatSched(token,testId,report_interval,run_interval,max_delay,emails);
   var schedId = await GetScheduleID(token,UID);
   await ToggleSched(token,schedId[0]);
   res.json({id:UID});
    }
    catch(err){
        res.json({status:"failed",error :err});
    }

});

app.post('/delete', async(req,res)=>{
    try{

        let auth = req.headers.authorization;
        let split = auth.split(' ');
        let base64 = split[1];
        let buff = Buffer.from(base64, 'base64');  
        let text = buff.toString('utf-8');
        let credentials = text.split(':');
        let username = credentials[0];
        let password = credentials[1];

        let id = req.body.id;
        token = await loginUser(username,password);
        var schedId = await GetScheduleID(token,id);
        await DeleteSched(schedId[0]);
        await DeleteTest(schedId[1]);

        res.json({status :"success"});

    }catch(err){

        res.json({status:"failed",error :err});
    }
    
});

app.get('/',(req,res)=>{
    
    res.send('<h1>API built by MM NOC team in order to schedule a test for a route, using testelium</h1>');
    
});
app.get('*', function(req, res){
  res.send('<h1>404 Not Found</h1>', 404);
});
app.listen(port, () => console.log(`listening on port ${port}!`))
