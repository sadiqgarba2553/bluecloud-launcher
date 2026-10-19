const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/ui',timeout:90000,workers:1,reporter:'list',outputDir:'.release/validation/desktop-tests',use:{screenshot:'only-on-failure'}});
