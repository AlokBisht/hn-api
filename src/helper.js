
const TOP_STORIES_COUNT = 10;
const TOP_COMMENTS_COUNT = 10;

const getTopStoriesByScore = (cache) => {
    const stories = Array.from(cache.values()).filter(item => item.type === 'story');
   return stories.sort( (a,b) => b.score - a.score ).slice(0, TOP_STORIES_COUNT);
}

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
    const comments = Array.from(cache.values()).filter(item => commentIds.includes(item.id));
    return comments.sort( (a,b) => getKidsCount(cache, b.kids) - getKidsCount(cache, a.kids) )
        .slice(0, TOP_COMMENTS_COUNT);
}

module.exports = {getTopStoriesByScore, getTopCommentsByChildComments};