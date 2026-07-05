npm run build ^
  && aws s3 sync dist/ s3://strava-mapy.com/ --delete ^
  && aws cloudfront create-invalidation --distribution-id E3JI1RZN12TAQP --paths "/*"
