FROM nginx:alpine

# Copy custom nginx configuration for Flutter Web SPA and reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled Flutter Web production assets
COPY build/web /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
