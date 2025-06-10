import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

// Cryptocurrencies to analyze - expanded list
const CRYPTOCURRENCIES = ['BTC', 'ETH', 'SOL'];

// Default Rhun Capital agent ID
const DEFAULT_AGENT_ID = 'cc425065-b039-48b0-be14-f8afa0704357';

// Default Rhun Capital template user ID
const DEFAULT_USER_ID = 'template';

// API configuration
const RHUN_API_URL = 'https://beta.rhun.io/api';

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const chatWithRhun = async (message) => {
  try {
    const { data } = await axios.post(`${RHUN_API_URL}/chat`, {
      messages: [{
        role: 'user',
        content: message
      }],
      agent: {
        id: DEFAULT_AGENT_ID,
        userId: DEFAULT_USER_ID
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.RHUN_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    });

    const lines = data.split('\n').filter(Boolean);
    let fullMessage = '';
    let toolResult = null;

    for (const line of lines) {
      if (line.startsWith('0:')) {
        const content = line.slice(2).trim().replace(/^["']|["']$/g, '');
        fullMessage += content;
      } else if (line.startsWith('a:')) {
        try {
          const resultData = JSON.parse(line.slice(2));
          if (resultData.result) {
            toolResult = resultData.result;
          }
        } catch (e) {
          console.error('Error parsing tool result:', e);
        }
      }
    }

    if (fullMessage) {
      const cleanedMessage = fullMessage.split('---')[0].trim();
      fullMessage = cleanedMessage;
    }

    const result = toolResult || { message: { content: fullMessage } };
    return result;
  } catch (error) {
    console.error('Full error details:', error);
    if (error.response) {
      console.error('API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      throw new Error(`Rhun API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw error;
  }
};

const parseAnalysisResponse = (analysis) => {
  if (!analysis) return null;

  try {
    const {
      symbol,
      currentPrice,
      priceChange,
      marketSentiment = { trend: 'neutral' }
    } = analysis;

    return {
      symbol,
      currentPrice: currentPrice || 0,
      priceChange: {
        '24h': priceChange?.['24h'] || 0
      },
      sentiment: marketSentiment.trend.toLowerCase()
    };
  } catch (error) {
    return null;
  }
};

const getNewsForAsset = async (symbol) => {
  try {
    // Get direct news response
    const newsPrompt = `What's the most significant news for ${symbol} in the last 24 hours? Include both articles and tweets.`;
    const newsResponse = await chatWithRhun(newsPrompt);
        
    // Parse the news response
    if (Array.isArray(newsResponse) && newsResponse.length > 0) {
      // Combine all news items into a single string for summarization
      const allNews = newsResponse.map(item => {
        if (item.type === 'tweet') {
          return `Tweet: ${item.text}`;
        }
        return `${item.title}. ${item.summary}`;
      }).join(' ');
            
      // Create a professional, concise summary from all news items
      const rephrasedResponse = await chatWithRhun(
        `Analyze and summarize all of this ${symbol} news into one clear, concise sentence that captures the most significant developments. Use a natural tone, like something you'd read in a headline or tweet, no overly formal or academic phrasing. No emojis or slang: ${allNews}`
      );

      // Extract the actual message content from the response
      const summary = rephrasedResponse?.message?.content || 
                     rephrasedResponse?.content;

      if (summary) {
        // Clean up the summary
        const cleanedSummary = summary
          .replace(/^["']|["']$/g, '') // Remove quotes
          .replace(/\n/g, ' ') // Remove newlines
          .trim();
        
        return cleanedSummary;
      } else {
        console.log(`No valid summary content found for ${symbol}`);
      }
    } else if (newsResponse?.message?.content) {
      // Try to use the direct message content if available
      const summary = newsResponse.message.content
        .replace(/^["']|["']$/g, '')
        .replace(/\n/g, ' ')
        .trim();
      
      return summary;
    } else {
      console.log(`No news array or valid content found for ${symbol}`, newsResponse);
    }
    return null;
  } catch (error) {
    console.error(`Error getting news for ${symbol}:`, error);
    return null;
  }
};

const getPriceChangeEmoji = (change) => {
  return change >= 0 ? '📈' : '📉';
};

const formatMarketUpdate = async (analysisResults) => {
  // Get news for each asset
  const assetsWithNews = await Promise.all(
    analysisResults.map(async (asset) => {
      const news = await getNewsForAsset(asset.symbol);
      return {
        ...asset,
        news
      };
    })
  );

  // Filter out assets with no significant updates
  const significantUpdates = assetsWithNews.filter(
    asset => (asset.news && asset.news !== 'No major updates' && asset.news !== 'null') || Math.abs(asset.priceChange['24h']) > 10
  );

  // Sort by absolute price change
  significantUpdates.sort((a, b) => 
    Math.abs(b.priceChange['24h']) - Math.abs(a.priceChange['24h'])
  );

  // Take top 3-4 most interesting assets
  const topUpdates = significantUpdates.slice(0, 4);

  // Format the market updates
  const updates = topUpdates.map(asset => {
    const priceEmoji = getPriceChangeEmoji(asset.priceChange['24h']);
    const change = asset.priceChange['24h'].toFixed(1);
    const pricePlusMinus = change >= 0 ? '+' : '-'; 
    const newsLine = asset.news && asset.news !== 'No major updates' && asset.news !== 'null'
      ? `📰 ${asset.news}`
      : '';
    
    // Only include this asset if it has news or a significant price change
    if (!newsLine && Math.abs(asset.priceChange['24h']) <= 10) {
      return null;
    }
    
    const update = [
      `${priceEmoji} $${asset.symbol}: ${pricePlusMinus}${change}% (24h)`
    ];
    
    if (newsLine) {
      update.push(newsLine);
    }
    
    return update.join('\n');
  }).filter(Boolean).join('\n\n');

  return updates
};

export const handler = async (event) => {
  try {
    // Get analysis for each coin
    const analysisResults = await Promise.all(
      CRYPTOCURRENCIES.map(async (symbol) => {
        try {
          const analysisResponse = await chatWithRhun(
            `Analyze ${symbol} and give me: current price, 24h change, and market sentiment (bullish/bearish/neutral).`
          );
          
          const analysis = parseAnalysisResponse(analysisResponse);
          return analysis;
        } catch (error) {
          return null;
        }
      })
    );
    
    const validResults = analysisResults.filter(Boolean);
    if (validResults.length === 0) {
      throw new Error('No valid analysis results obtained');
    }

    // Format the market update
    const tweetText = await formatMarketUpdate(validResults);
    
    // Print the tweet for logging
    console.log('\n📱 Generated Tweet:');
    console.log('----------------------------------------');
    console.log(tweetText);
    console.log('----------------------------------------\n');

    // Send the tweet
    try {
      const tweet = await twitterClient.v2.tweet(tweetText);
      console.log('Tweet sent successfully:', tweet.data.id);
    } catch (twitterError) {
      console.error('Error sending tweet:', twitterError);
      throw new Error('Failed to send tweet: ' + twitterError.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully generated and sent market update',
        tweet: tweetText,
        tweetId: tweet.data.id
      })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to generate or send market update',
        error: error.message
      })
    };
  }
};
