const express = require('express');
const https = require('https');
const http = require('http');
const storyApi = require('./api/story');

const app = new express();

const PORT = process.env.PORT || 3000;

app.use(storyApi);

app.get('/', (request, response) => {
    response.send({
        "APIs": {
            "1": "/top-stories ",
            "2": "/comments/{storyId}",
        },
    });
});

http.createServer(app).listen(PORT,  () => {
    console.log(`server started at ${PORT}`);
});

