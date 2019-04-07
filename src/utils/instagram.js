const fetch = require('node-fetch');
const cheerio = require('cheerio');

const INSTAGRAM_URL = 'https://www.instagram.com/';

const sum = (a, b) => a + b;

const getInstagramUserInfo = async accountName => {
  try {
    const pageHtml = await fetch(INSTAGRAM_URL + accountName).then(response =>
      response.text(),
    );
    const $ = cheerio.load(pageHtml);
    const script = $('script')
      .eq(4)
      .html();

    if (!script) {
      return null;
    }

    const parseResult = /window\._sharedData = (.+);/g.exec(script);
    if (!parseResult) {
      return null;
    }

    const {
      entry_data: {
        ProfilePage: {
          [0]: {
            graphql: { user },
          },
        },
      },
    } = JSON.parse(parseResult[1]);

    return user;
  } catch (err) {
    console.error(
      'Возникла ошибка при получении пользователя инстаграмма:',
      err,
    );

    return null;
  }
};
const getUserDescription = user => {
  return user.biography;
};

const getUserLikesCount = (user, count) => {
  const posts = user.edge_owner_to_timeline_media.edges.splice(count);
  const likes = posts.reduce(
    (likes, post) => (likes.push(post.node.edge_liked_by.count), likes),
    [],
  );
  return (likes.reduce(sum, 0) / likes.length) | 0;
};

const parseInstagramAccount = async accountName => {
  const instaUser = await getInstagramUserInfo(accountName);
  const likes = getUserLikesCount(instaUser, 10);
  const description = getUserDescription(instaUser);

  return { login: accountName, description, likes };
};

module.exports = {
  getInstagramUserInfo,
  parseInstagramAccount,
};
