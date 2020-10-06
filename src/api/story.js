const express = require('express');
const fetch = require('node-fetch');
const lodash = require('lodash');
const { getTopStoriesByScore, getTopCommentsByChildComments } = require('../helper');


// to cache all network calls
const itemCache = new Map();

// to cache all network cals
const apiHistoryCache = new Map();

// to cache all calculated API responses
const apiCache = new Map();

// clear cache 
const CACHE_STALE_TIME_IN_MINUTES = 10;
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
        // 1 year  = 31536000000 miliseconds
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
    await Promise.all(stories.map(story => getItemDetails(story)));
    const top = getTopStoriesByScore(itemCache);
    apiCache.set('topStories', top.map(story => lodash.pick(story, storykeys)));
    // setting the history cahce uniquely whenever a new top story response is calculated
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

const getComments = async (comments, storyId) => {
    await Promise.all(comments.map(comment => getCommentWithKids(comment)));

    const topcomments = getTopCommentsByChildComments(itemCache, comments);

    // get users details only for the users in top comments to avoid unnecessary network calls
    await Promise.all(topcomments.map(cm => getuserDetails(cm.by)));

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
    // if the cache doesn't have comments for story then seek in HN API
    if (!apiCache.get(Number(storyId))) {
        const storyDetails = await getItemDetails(Number(storyId));
        if (storyDetails.type !== 'story') {
            response.send('The requested id is not a story');
        }
        await getComments(storyDetails.kids, storyDetails.id);
    }
    response.send(apiCache.get(Number(storyId)));
}

// all supported APIs
const router = express.Router();
router.get('/top-stories', getTopStories);
router.get('/comments/:storyId', getTopComments);
router.get('/past-stories', getPastStories);
module.exports = router;