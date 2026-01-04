--[[
    https://github.com/overextended/ox_lib

    This file is licensed under LGPL-3.0 or higher <https://www.gnu.org/licenses/lgpl-3.0.en.html>

    Copyright © 2025 Linden <https://github.com/thelindat>
]]

local input
local lation_ui = GetResourceState('lation_ui') == 'started'

---@class InputDialogRowProps
---@field type 'input' | 'number' | 'checkbox' | 'select' | 'slider' | 'multi-select' | 'date' | 'date-range' | 'time' | 'textarea' | 'color'
---@field label string
---@field options? { value: string, label: string, default?: string }[]
---@field password? boolean
---@field icon? string | {[1]: IconProp, [2]: string};
---@field iconColor? string
---@field placeholder? string
---@field default? string | number
---@field disabled? boolean
---@field checked? boolean
---@field min? number
---@field max? number
---@field step? number
---@field autosize? boolean
---@field required? boolean
---@field format? string
---@field returnString? boolean
---@field clearable? boolean
---@field searchable? boolean
---@field description? string
---@field maxSelectedValues? number
---@field minLength? number
---@field maxLength? number

---@class InputDialogOptionsProps
---@field allowCancel? boolean
---@field size? 'xs' | 'sm' | 'md' | 'lg' | 'xl'

---@param heading string
---@param rows string[] | InputDialogRowProps[]
---@param options InputDialogOptionsProps[]?
---@return string[] | number[] | boolean[] | nil
function lib.inputDialog(heading, rows, options)
    if lation_ui then
        local data = { title = heading }

        data.options = type(rows) == 'table' and rows or { rows }

        for i, option in ipairs(data.options) do
            if type(option) == 'string' then
                data.options[i] = { type = 'input', label = option }
            elseif type(option) == 'table' and not option.type then
                option.type = 'input'
            end
        end

        if type(options) == 'table' then
            for k, v in pairs(options) do
                data[k] = v
            end
            if options.allowCancel ~= nil then
                data.cancel = options.allowCancel
            end
        end

        return exports.lation_ui:input(data)
    end

    if input then return end
    input = promise.new()

    -- Backwards compat with string tables
    for i = 1, #rows do
        if type(rows[i]) == 'string' then
            rows[i] = { type = 'input', label = rows[i] --[[@as string]] }
        end
    end

    lib.setNuiFocus(false)
    SendNUIMessage({
        action = 'openDialog',
        data = {
            heading = heading,
            rows = rows,
            options = options
        }
    })

    return Citizen.Await(input)
end

function lib.closeInputDialog()
    if lation_ui then return exports.lation_ui:closeInput() end

    if not input then return end

    lib.resetNuiFocus()
    SendNUIMessage({
        action = 'closeInputDialog'
    })

    input:resolve(nil)
    input = nil
end

RegisterNUICallback('inputData', function(data, cb)
    cb(1)
    lib.resetNuiFocus()

    local promise = input
    input = nil

    promise:resolve(data)
end)
