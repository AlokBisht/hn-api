const express = require('express');
const fetch = require('node-fetch');
const lodash = require('lodash');
const { getTopStoriesByScore, getTopCommentsByChildComments } = require('../helper');


// to cache all network cals
const itemCache = new Map();

// to cache all network cals
const apiHistoryCache = new Map();

// to cache all calculated API responses
const apiCache = new Map();

// clear cache 
const CACHE_STALE_TIME_IN_MINUTES = 1;
const timeout = () => {
    setTimeout(function () {
        itemCache.clear();
        apiCache.clear();
        timeout();
    }, CACHE_STALE_TIME_IN_MINUTES * 60 * 1000);
};
timeout();

// generic method for getting item details
const getItemDetails = async (id) => {
    let itemDetails = itemCache.get(id);
    if (itemDetails) {
        return itemDetails;
    }
    try {
        const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        itemDetails = await itemResponse.json();
        itemCache.set(id, itemDetails);
    } catch (e) {
        itemDetails = undefined;
    }
    return itemDetails;
}

const getuserDetails = async (id) => {
    let userDetails = itemCache.get(id);
    if (userDetails) {
        return userDetails;
    }
    try {
        const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/user/${id}.json`);
        userDetails = await itemResponse.json();
        userDetails.age = (Date.now() - userDetails.created) / 31536000000;
        itemCache.set(id, userDetails);
    } catch (e) {
        userDetails = undefined;
    }
    return userDetails;
}

const storykeys = ['title', 'url', 'score', 'time', 'by'];
const getStories = async () => {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty');
    const stories = await res.json();
    const promises = [];
    for (let index = 0; index < stories.length; index++) {
        promises.push(getItemDetails(stories[index]));
    }
    await Promise.all(promises);
    const top = getTopStoriesByScore(itemCache);
    apiCache.set('topStories', top.map(story => lodash.pick(story, storykeys)));
    apiHistoryCache.set('pastStories',
        lodash.uniq( [...(apiHistoryCache.get('pastStories') || []),
                 ...top.map(s => s.id)])
        );
}

const getTopStories = async (request, response) => {
    if (!apiCache.get('topStories')) {
        await getStories();        
    }
    response.send(apiCache.get('topStories'));
}

const getPastStories = async (request, response) => {
    response.send(apiHistoryCache.get('pastStories'));
}

const getCommentWithKids = async (commentId) => {
    const stack = [commentId];
    while (stack.length) {
        const id = stack.pop();
        const commentDetails = await getItemDetails(id);
        if (commentDetails && commentDetails.kids) {
            stack.push(...(commentDetails.kids));
        }
    }
}

const getUsers = async (userIds) => {
    const promises = [];
    for (let index = 0; index < userIds.length; index++) {
        promises.push(
            getuserDetails(userIds[index])
        );
    }
    await Promise.all(promises);
}

const getComments = async (comments, storyId) => {
    const promises = [];
    for (let index = 0; index < comments.length; index++) {
        promises.push(
            getCommentWithKids(comments[index])
        );
    }
    await Promise.all(promises);

    const topcomments = getTopCommentsByChildComments(itemCache, comments);

    // get users details only for the users in top comments
    await getUsers(topcomments.map(cm => cm.by));

    apiCache.set(storyId,
        topcomments.map((comment) => {
            return {
                text: comment.text,
                handle: comment.by,
                age: itemCache.get(comment.by).age,
            };
        })
    );
}

const getTopComments = async (request, response) => {
    const { storyId } = request.params;
    const storyComments = apiCache.get(Number(storyId));
    if (!storyComments) {
        const storyDetails = await getItemDetails(Number(storyId));
        if (storyDetails.type !== 'story') {
            response.send('The requested id is not a story');
        }
        await getComments(storyDetails.kids, storyDetails.id);
    }
    response.send(apiCache.get(Number(storyId)));
}


const router = express.Router();
router.get('/top-stories', getTopStories);
router.get('/comments/:storyId', getTopComments);
router.get('/past-stories', getPastStories);
module.exports = router;