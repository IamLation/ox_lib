--[[
    https://github.com/overextended/ox_lib

    This file is licensed under LGPL-3.0 or higher <https://www.gnu.org/licenses/lgpl-3.0.en.html>

    Copyright © 2025 Linden <https://github.com/thelindat>
]]

---@class TextUIOptions
---@field position? 'right-center' | 'left-center' | 'top-center' | 'bottom-center';
---@field icon? string | {[1]: IconProp, [2]: string};
---@field iconColor? string;
---@field style? string | table;
---@field alignIcon? 'top' | 'center';

local isOpen = false
local currentText
local lation_ui = GetResourceState('lation_ui') == 'started'

---@param text string
---@param options? TextUIOptions
function lib.showTextUI(text, options)
    if lation_ui then
        if type(text) == 'table' and options == nil then
            return exports.lation_ui:showText(text)
        end
        local data = options or {}
        data.description = text
        return exports.lation_ui:showText(data)
    end

    if currentText == text then return end

    if not options then options = {} end

    options.text = text
    currentText = text

    SendNUIMessage({
        action = 'textUi',
        data = options
    })

    isOpen = true
end

function lib.hideTextUI()
    if lation_ui then return exports.lation_ui:hideText() end

    SendNUIMessage({
        action = 'textUiHide'
    })

    isOpen = false
    currentText = nil
end

---@return boolean, string | nil
function lib.isTextUIOpen()
    if lation_ui then return exports.lation_ui:isOpen() end

    return isOpen, currentText
end
