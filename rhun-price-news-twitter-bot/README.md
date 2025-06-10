# Rhun Price and Bews Bot

A Lambda function that generates automated cryptocurrency market updates using Rhun's AI capabilities and Twitter API. The bot analyzes multiple cryptocurrencies (BTC, ETH, SOL), gathering price data, market sentiment, and relevant news to create concise, informative tweets.

## Features

- Real-time cryptocurrency price analysis
- Market sentiment analysis
- News aggregation and summarization
- Automated tweet generation
- Supports multiple cryptocurrencies simultaneously

## Prerequisites

- AWS Account
- Node.js 18.x or later
- Rhun API Key
- Twitter Developer Account with API credentials

## Setup

### 1. Rhun API Key

1. Visit [rhun.io](https://rhun.io)
2. Launch the app and sign in with your wallet
3. Navigate to the `/account` page
4. Generate your API key
5. Replace the `DEFAULT_USER_ID` in the code with your user ID from the account page

### 2. Twitter API Setup

You'll need to create a Twitter Developer account and generate the following credentials:
- API Key
- API Secret
- Access Token
- Access Token Secret

### 3. AWS Configuration

#### Environment Variables

The following environment variables need to be configured in your Lambda function:

```
RHUN_API_KEY=your_rhun_api_key
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret
```

#### Production Security Best Practices

For production deployments, it's recommended to store sensitive credentials in AWS Secrets Manager:

1. Create a new secret in AWS Secrets Manager containing your API keys
2. Update your Lambda function's IAM role to include permissions to access these secrets
3. Modify the code to retrieve secrets from AWS Secrets Manager

Example IAM policy for Secrets Manager access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": "arn:aws:secretsmanager:*:*:secret:your-secret-name-*"
        }
    ]
}
```

## Deployment

1. Package your code:
```bash
zip -r function.zip index.js node_modules package.json
```

2. Deploy to AWS Lambda:
- Create a new Lambda function
- Choose Node.js 18.x runtime
- Upload the function.zip file
- Set the handler to "index.handler"
- Configure environment variables or secrets
- Set appropriate memory and timeout values (recommended: 256MB memory, 30s timeout)

## Lambda Configuration

- **Runtime**: Node.js 18.x
- **Handler**: index.handler
- **Memory**: 256MB (recommended)
- **Timeout**: 30 seconds (recommended)
- **Trigger**: Configure based on your needs (CloudWatch Events for scheduled execution)

## Local Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your credentials:
```
RHUN_API_KEY=your_rhun_api_key
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret
```

4. Test locally:
```bash
node -e "require('./index.js').handler({})"
```

## Error Handling

The function includes comprehensive error handling:
- API call failures
- Data parsing errors
- Invalid responses
- Missing credentials

All errors are logged and returned with appropriate HTTP status codes.

## License

MIT
