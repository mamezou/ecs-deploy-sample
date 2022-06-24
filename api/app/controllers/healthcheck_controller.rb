class HealthcheckController < ApplicationController
  def hc
    ActiveRecord::Base.connection.execute("SELECT 1")
    render json: { status: 'ok' }
  end
end
