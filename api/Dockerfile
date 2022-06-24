# # syntax=docker/dockerfile:1
FROM ruby:2.5

# Configure the main process to run when running the image
# CMD ["rails", "server", "-b", "0.0.0.0"]

WORKDIR /usr/src/app
COPY . /usr/src/app
RUN apt-get update -qq && apt-get install -y nodejs postgresql-client
COPY Gemfile /usr/src/app/Gemfile
COPY Gemfile.lock /usr/src/app/Gemfile.lock
RUN bundle install


EXPOSE 3000

ENV RAILS_ENV=production

RUN chmod +x /usr/src/app/entrypoint.sh
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

VOLUME /usr/src/app/

CMD /bin/sh -c "bundle exec rails s -p 3000 -e production"
