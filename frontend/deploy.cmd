npm run build ^
  && aws s3 sync dist/ s3://strava-mapy.com/ --delete --exclude "shared-data/*" --exclude "*.html" --cache-control "public, max-age=31536000, immutable" ^
  && aws s3 sync dist/ s3://strava-mapy.com/ --exclude "*" --include "*.html" --cache-control "no-cache" ^
  && aws cloudfront create-invalidation --distribution-id E3JI1RZN12TAQP --paths "/*"
