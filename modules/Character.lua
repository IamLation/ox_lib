---@meta Ox.Character

local Class = require 'Ox.Class'
local RemoteClassConsumer = require 'Ox.RemoteClassConsumer'

---@class Character : RemoteClassConsumer
---@field connect fun(): Character
---@field fromId fun(id: string | number): Character
---@field id number
---@field userId number
---@field uuid string
---@field set fun(self: Character, key: string, value: unknown): boolean
---@field get fun(self: Character, ...: string): { [string]: unknown }
local Character = Class('Character', RemoteClassConsumer)
Character.resource = 'ox_lib'

return Character
