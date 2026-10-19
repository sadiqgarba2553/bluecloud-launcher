// Signing is opt-in. Credentials are read by electron-builder from the environment.
const base=require('./package.json').build;
const enabled=process.env.BLUECLOUD_SIGN_WINDOWS==='1';
const thumbprint=process.env.BLUECLOUD_CERT_THUMBPRINT;
if(enabled&&!process.env.CSC_LINK&&!process.env.WIN_CSC_LINK&&!thumbprint)throw Error('Signing requested without a certificate. Set CSC_LINK or BLUECLOUD_CERT_THUMBPRINT.');
if(thumbprint&&!/^[a-fA-F0-9]{40}$/.test(thumbprint))throw Error('Invalid signing-certificate thumbprint');
module.exports={...base,forceCodeSigning:enabled,win:{...base.win,signExecutable:enabled,...(enabled?{signtoolOptions:{signingHashAlgorithms:['sha256'],...(thumbprint?{certificateSha1:thumbprint}:{})}}:{})}};
