---@meta Ox.RemoteClassConsumer

local Class = require 'Ox.Class'

---@class RemoteClassConsumer : OxClass
---@field resource string
---@field connect fun(): RemoteClassConsumer
---@field fromId fun(id: string | number): RemoteClassConsumer
local RemoteClassConsumer = Class('RemoteClassConsumer')

local weakKeys = { __mode = 'k' }
local bindings = setmetatable({}, weakKeys)
local identifiers = setmetatable({}, weakKeys)
local classMethods = {}

local function normalizeId(id)
    local typeof = type(id)

    if id then
        if typeof == 'string' then return id end

        if typeof == 'number' and id >= math.mininteger and id <= math.maxinteger then
            return tostring(id)
        end
    end

    error('A remote identifier must be a string or finite number.')
end

local function callRemote(resource, name, operation, ...)
    return exports[resource]:__remote_class(name, operation, ...)
end

local function findMember(class, key)
    while class do
        local value = rawget(class, key)

        if value ~= nil then return value end

        class = getmetatable(class)
    end
end

local function index(self, key)
    local classMethod = classMethods[key]

    if classMethod and rawget(self, '__name') then
        return function(...) return classMethod(self, ...) end
    end

    local binding = bindings[self]

    if binding then
        if binding.staticProperties[key] then
            return callRemote(binding.resource, binding.name, 'read_static', key)
        end

        local method = binding.staticMethods[key]

        if method then return method end
    end

    return findMember(getmetatable(self), key)
end

RemoteClassConsumer.__index = index

local function checkMembers(consumer, members, label)
    for _, member in ipairs(members) do
        if classMethods[member] or findMember(consumer, member) ~= nil then
            error(("%s already defines %s'%s'."):format(consumer.__name, label, member), 3)
        end
    end
end

local function bindConsumer(consumer)
    local name = consumer.__name
    local resource = type(consumer.resource) == 'string' and consumer.resource:match('^%s*(.-)%s*$')

    if not resource or resource == '' then
        error(('%s requires a non-empty static resource.'):format(name), 3)
    end

    local existing = bindings[consumer]

    if existing then
        if name ~= existing.name or resource ~= existing.resource then
            error(("%s is already bound to '%s:%s'."):format(name, existing.resource, existing.name), 3)
        end

        return existing
    end

    local refs = callRemote(resource, name, 'refs')

    -- An export may yield while another caller binds the same class.
    if bindings[consumer] then return bindConsumer(consumer) end

    checkMembers(consumer, refs.methods, '')
    checkMembers(consumer, refs.properties, '')
    checkMembers(consumer, refs.statics.methods, 'static member ')
    checkMembers(consumer, refs.statics.properties, 'static member ')

    local identifier = refs.identifier
    local methods = {}
    local staticMethods = {}
    local staticProperties = {}

    for _, method in ipairs(refs.methods) do
        methods[method] = function(self, ...)
            return callRemote(resource, name, 'invoke', normalizeId(identifiers[self]), method, ...)
        end
    end

    for _, method in ipairs(refs.statics.methods) do
        staticMethods[method] = function(...)
            return callRemote(resource, name, 'invoke_static', method, ...)
        end
    end

    for _, property in ipairs(refs.statics.properties) do
        staticProperties[property] = true
    end

    local originalIndex = rawget(consumer, '__index')
    local originalNewIndex = rawget(consumer, '__newindex')

    rawset(consumer, '__index', function(self, key)
        local id = identifiers[self]

        if id ~= nil then
            if key == identifier then return id end
            if methods[key] then return methods[key] end
        end

        if rawget(self, '__name') then return index(self, key) end
        if type(originalIndex) == 'function' then return originalIndex(self, key) end

        if originalIndex ~= consumer then return originalIndex[key] end

        return index(self, key)
    end)

    rawset(consumer, '__newindex', function(self, key, value)
        if key == identifier and identifiers[self] ~= nil then
            error(("Remote identifier '%s' is read-only."):format(key), 2)
        end

        if type(originalNewIndex) == 'function' then return originalNewIndex(self, key, value) end

        if originalNewIndex then
            originalNewIndex[key] = value
            return
        end

        rawset(self, key, value)
    end)

    local binding = {
        name = name,
        resource = resource,
        identifier = identifier,
        properties = refs.properties,
        staticMethods = staticMethods,
        staticProperties = staticProperties,
        instances = setmetatable({}, { __mode = 'v' }),
    }

    bindings[consumer] = binding
    return binding
end

---Binds this class to its remote provider.
function classMethods.connect(self)
    bindConsumer(self)
    return self
end

---Returns the cached proxy for this ID or reads a new snapshot from the provider.
---@param id string | number
function classMethods.fromId(self, id)
    local key = normalizeId(id)
    local binding = bindConsumer(self)
    local identifier = binding.identifier

    if not identifier then error(('%s does not expose instances.'):format(binding.name), 2) end

    local instances = binding.instances

    if instances[key] then return instances[key] end

    local snapshot = callRemote(binding.resource, binding.name, 'read', key)

    if type(snapshot) ~= 'table' or normalizeId(snapshot[identifier]) ~= key then
        error(("%s returned a different identifier for '%s'."):format(binding.name, key), 2)
    end

    if instances[key] then return instances[key] end

    local instance = self:new()

    if instances[key] then return instances[key] end

    for _, property in ipairs(binding.properties) do
        rawset(instance, property, snapshot[property])
    end

    rawset(instance, identifier, nil)
    identifiers[instance] = snapshot[identifier]
    instances[key] = instance

    return instance
end

return RemoteClassConsumer
