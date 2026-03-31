module.exports=async function handler(_req,res){res.status(200).json({ok:true,app:'FoodMirror',time:new Date().toISOString()});};
