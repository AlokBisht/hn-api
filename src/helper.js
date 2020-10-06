
const TOP_STORIES_COUNT = 10;
const TOP_COMMENTS_COUNT = 10;

const getTopStoriesByScore = (cache) => {
    // cache can have both "story" and "job" (as well "comments"), so below filtering
    const stories = Array.from(cache.values()).filter(item => item.type === 'story');
    return stories.sort( (a,b) => b.score - a.score ).slice(0, TOP_STORIES_COUNT);
}

// a graph search in the cache until we calculate the count of all the desendent comments
const getKidsCount = (cache, ids) => {
    if(!ids || !ids.length) {
        return 0;
    }
    const kids = [...ids];
    let kidsCount = 0;
    while(kids.length) {
        const kid = kids.pop();
        kidsCount += 1;
        const kidDetail = cache.get(kid);
        if(kidDetail && kidDetail.kids) {
            kids.push(kidDetail.kids);
        }
    }
    return kidsCount;
}

const getTopCommentsByChildComments = (cache, commentIds) => {
    // get only comments those belong to the requested story
    const comments = Array.from(cache.values()).filter(item => commentIds.includes(item.id));
    return comments.sort( (a,b) => getKidsCount(cache, b.kids) - getKidsCount(cache, a.kids) )
        .slice(0, TOP_COMMENTS_COUNT);
}

module.exports = {getTopStoriesByScore, getTopCommentsByChildComments};