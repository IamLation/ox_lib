---@meta Ox.User

local Class = require 'Ox.Class'
local RemoteClassConsumer = require 'Ox.RemoteClassConsumer'

---@class User : RemoteClassConsumer
---@field connect fun(): User
---@field fromId fun(id: string | number): User
---@field id number
---@field license string
---@field set fun(self: User, key: string, value: unknown): boolean
---@field get fun(self: User, ...: string): { [string]: unknown }
local User = Class('User', RemoteClassConsumer)
User.resource = 'ox_lib'

return User
