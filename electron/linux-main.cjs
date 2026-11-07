if(process.env.BLUECLOUD_SYSTEM_PACKAGES==='1'||__dirname.startsWith('/usr/lib/bluecloud/bluecloud-launcher/')){require('./linux-system.cjs');}else{require('./linux-portable.cjs');}
