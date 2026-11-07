const base=require('./package.json').build;
module.exports={...base,files:[...base.files,'linux-config.json'],extraResources:[],linux:{target:['AppImage','deb'],category:'Utility',maintainer:'BLUECLOUD <sadeeqsgi@icloud.com>',icon:'assets/launcher.png',artifactName:'BlueCloud-Launcher-${version}-${arch}.${ext}'}};
